# SendMedia — Secure P2P File Sharing

![SendMedia Logo](https://img.shields.io/badge/Status-Complete-success)
![WebRTC](https://img.shields.io/badge/Protocol-WebRTC-blue)
![P2P](https://img.shields.io/badge/Link-P2P-orange)

SendMedia is a high-performance, serverless, peer-to-peer (P2P) file sharing application built with React, Tailwind CSS, and WebRTC. It allows users to transfer files of any size directly between devices with zero cloud storage and absolute privacy.

---

## ✨ Key Features

- **Direct P2P Transfer**: No intermediary servers. Data travels directly from browser to browser.
- **No File Size Limit**: Transfer multi-gigabyte files without restrictions.
- **End-to-End Encrypted**: Built-in DTLS encryption ensures only you and the receiver can access the data.
- **Zero Configuration**: Manual signaling via QR codes or copy-paste keys — no need for complex setup or backend accounts.
- **Rich UI/UX**:
  - Real-time speed & progress tracking.
  - ETA (Estimated Time of Arrival) calculation.
  - Beautiful glassmorphism design with dark/light mode support.
  - Sequential file queue for stable transfers.
- **Cross-Platform**: Works on any modern browser (Chrome, Firefox, Safari, Edge) on Desktop and Mobile.
- **Mini Chat**: Built-in chat feature to communicate with the peer during transfers.

## 🚀 How It Works

SendMedia uses **WebRTC (Web Real-Time Communication)** for direct data channels.

1.  **Sender**: Select files and generate a connection "Offer" (QR code or key).
2.  **Receiver**: Scan the QR or paste the Offer key, then generate an "Answer".
3.  **Establish**: Once the sender accepts the Answer, a secure P2P tunnel is opened.

> [!NOTE]
> **Privacy First**: Files are never uploaded to any server. If you refresh the page or close the tab, the connection is instantly severed and no data remains on the web.

## 🛠 Tech Stack

- **Frontend**: React 18, Vite
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **WebRTC Implementation**: `simple-peer`
- **UI Components**: shadcn/ui (Radix UI)
- **Icons**: Lucide React
- **QR Engine**: `qrcode.react`, `html5-qrcode`

## 📦 Installation & Development

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Setup
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd send-media
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## 🔒 Security & Architecture

SendMedia is designed with a "Privacy by Design" approach:
- **Signaling**: The QR codes/Keys contain the necessary SDP (Session Description Protocol) data to find the other device.
- **Transport**: Uses the SCTP protocol over DTLS for reliable and secure data delivery.
- **No Backend**: The app is entirely client-side. STUN servers are used only to discover public IP addresses for NAT traversal.

## 📄 License
This project is licensed under the MIT License.
