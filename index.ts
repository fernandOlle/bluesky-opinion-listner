import AtProto from '@atproto/api';
import { cborDecode, cborDecodeMulti } from '@atproto/common';
import { CarReader } from '@ipld/car/reader';
import process from 'process';
import WebSocket from 'ws';

const agent = new AtProto.BskyAgent({
  service: 'https://bsky.social',
});

await agent.login({
  identifier: process.env.BLUESKY_USERNAME!,
  password: process.env.BLUESKY_PASSWORD!,
});

type Payload =
  & AtProto.ComAtprotoSyncSubscribeRepos.Commit
  & {
    ops?: AtProto.ComAtprotoSyncSubscribeRepos.RepoOp[],
  };

const ws = new WebSocket(
  'wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos'
);

const args = process.argv.slice(2);
const keyWord = args[0];
// const password = args[1];

console.log(`Escutando mensagens sobre: [${keyWord}]`);


ws.on('message', async (data: Uint8Array) => {
  const [, payload] = cborDecodeMulti(
    data,
  ) as [unknown, Payload];

  try {
    const {
      ops,
      blocks,
      repo,
    } = payload;

    if (!Array.isArray(ops)) {
      return;
    }

    const [op] = ops;

    if (op?.action !== 'create') {
      return;
    }

    const cr = await CarReader.fromBytes(blocks);
    const block = await cr.get(op.cid);

    if (!block?.bytes) {
      return;
    }

    const post = cborDecode(
      block.bytes,
    ) as AtProto.AppBskyFeedPost.Record;

    const regex = new RegExp(keyWord, 'gmi');
    const hasTag = regex.test(post.text);

    if (!hasTag) {
      return;
    }

    console.log(post)

  } catch (exception) {
    console.error(exception);
  }
});
