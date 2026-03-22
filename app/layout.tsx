export const metadata = {
  title: "Plonopolis",
  description: "Gra farmerska",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
