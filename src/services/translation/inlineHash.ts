import * as Crypto from 'expo-crypto';
import type { InlineNode } from '@/types/content';

interface SerializedNode {
  t: string;
  x?: string;
  c?: number;
}

function serialize(node: InlineNode): SerializedNode {
  if (node.type === 'text') return { t: 'text', x: node.text };
  if (node.type === 'footnote-ref') return { t: 'footnote-ref' };
  return { t: node.type, c: 'children' in node ? node.children.length : 0 };
}

export async function inlineHash(inlines: InlineNode[]): Promise<string> {
  const flat = inlines.map(serialize);
  const stringified = JSON.stringify(flat);
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, stringified);
  return hash.slice(0, 16);
}
