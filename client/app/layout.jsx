// client/app/layout.jsx
import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';

export const metadata = {
  title: 'Procurement System | Nigerian Tertiary Institutions',
  description: 'Web-Based Digital Procurement Requisition System for Tertiary Institutions in Nigeria',
  keywords: 'procurement, requisition, e-procurement, tertiary institutions, Nigeria',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body>
        <AuthProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
