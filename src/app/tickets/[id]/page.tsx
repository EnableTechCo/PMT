import TicketWorkspace from "@/components/TicketWorkspace";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketWorkspace ticketId={id} />;
}
