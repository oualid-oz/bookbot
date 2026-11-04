import { redirect } from 'next/navigation';

/** The cover editor is now a step of the project page */
export default async function CoverPage({ params }: PageProps<'/projects/[id]/cover'>) {
  redirect(`/projects/${(await params).id}?step=cover`);
}
