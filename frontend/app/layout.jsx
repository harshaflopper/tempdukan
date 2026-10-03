import './globals.css';

export const metadata = {
  title: 'LastDukan - AI Product Onboarding',
  description: 'AI-powered inventory onboarding for village shopkeepers',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 font-sans antialiased min-h-screen flex justify-center">
        <div className="w-full max-w-lg px-4 py-4 md:py-6 flex flex-col gap-4">
          {children}
        </div>
      </body>
    </html>
  );
}
