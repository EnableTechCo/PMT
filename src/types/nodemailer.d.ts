declare module "nodemailer" {
  export interface Transporter {
    verify(): Promise<void>;
    sendMail(options: {
      from?: string;
      to: string;
      subject: string;
      html?: string;
      text?: string;
      [key: string]: unknown;
    }): Promise<unknown>;
  }

  export function createTransport(options: {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user?: string; pass?: string };
    [key: string]: unknown;
  }): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };

  export default nodemailer;
}
