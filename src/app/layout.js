import "./globals.css";

export const metadata = {
  title: "The Blade Hair Studio",
  description: "Sharp cuts. No riff raff.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
