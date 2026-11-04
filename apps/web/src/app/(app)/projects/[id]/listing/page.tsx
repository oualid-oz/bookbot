import { redirect } from 'next/navigation';

/** The listing editor is now a step of the project page */
export default async function ListingPage({ params }: PageProps<'/projects/[id]/listing'>) {
  redirect(`/projects/${(await params).id}?step=listing`);
}
