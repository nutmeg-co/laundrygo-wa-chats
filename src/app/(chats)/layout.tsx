import { Metadata, Viewport } from "next";

export const metadata: Metadata = {
	title: "WA Marketing Chats",
	description: "Generated by Next.js",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1.0,
	maximumScale: 1.0,
	userScalable: false,
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
