import { SearchWorkflow } from "@/components/search/search-workflow";

type SearchPageProps = {
  searchParams: Promise<{
    query?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;

  return <SearchWorkflow initialQuery={params.query ?? ""} />;
}
