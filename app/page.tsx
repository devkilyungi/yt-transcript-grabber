import { App } from '@/components/App';

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  return <App initial={{ v: one(q.v), list: one(q.list), videos: one(q.videos) }} />;
}
