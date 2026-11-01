import { FichaContato } from './FichaContato';

export const metadata = { title: 'Contato' };

export default async function PaginaContato({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FichaContato id={id} />;
}
