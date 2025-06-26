import { createTransport, SendMailOptions } from "nodemailer";
import SMTPTransport = require("nodemailer/lib/smtp-transport");
import { decode } from "rfc2047";

export interface IParsedMBox {
    body: string;
    cc?: string[];
    date?: string;
    from?: string;
    headers?: Array<{ key: string; value: string }>;
    messageId?: string;
    subject?: string;
    to?: string;
    raw: string;
}

export interface ISMTPOptions {
    smtpUser: string;
    smtpHost: string;
    smtpOpts?: string;
    smtpPass: string;
}

export async function parseHeadersAndSendMail(mbox: string,
    smtpOptions: ISMTPOptions):
    Promise<string> {
    return await sendMail(parseMBox(mbox), smtpOptions);
}

function replaceAll(input: string, pattern: string, replacement: string):
    string {
    return input.split(pattern).join(replacement);
}

/**
 * Parses a mail in mbox format, in preparation for sending it.
 *
 * Note: this function does *not* validate the input. For example, it does not
 * error out if, say, duplicate `Date:` headers were provided.
 *
 * @param {string} mbox The mail, in mbox format
 * @returns {IParsedMBox} the parsed headers/body
 */
export function parseMBox(mbox: string, gentle?: boolean): IParsedMBox {

    const headerEnd = mbox.indexOf("\n\n");
    if (headerEnd < 0) {
        throw new Error("Could not parse mail");
    }
    const headerStart = mbox.startsWith("From ") ? mbox.indexOf("\n") + 1 : 0;

    const header = mbox.substr(headerStart, headerEnd - headerStart);
    const body = mbox.substr(headerEnd + 2);

    let cc: string[] | undefined;
    let date: string | undefined;
    let from: string | undefined;
    const headers = new Array<{ key: string; value: string }>();
    let messageId: string | undefined;
    let subject: string | undefined;
    let to: string | undefined;

    let lines = header.split(/\n(?![ \t])/);

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].replace("\r\n", "\n").replace("\n", " ");

        let colon = line.indexOf(": ");

        //if (colon < 0 && line.endsWith(":") && i < lines.length - 1) {
        //    process.stdout.write(`parseMBox - no colon in line, : ${mbox}\n`);
        //    process.stdout.write(`parseMBox - line mext : ${mbox}\n`);
        //    colon = line.length - 1;
        //    i++;
        //    line += lines[i];
        //}
        if (colon < 0 && line.lastIndexOf(":") === line.length - 1) {
            // Keys without value are valid
            continue;
        }
        if (colon < 0) {
            ////process.stdout.write(`parseMBox - no colon in line, just ignore that for now: ${mbox}\n`);
            process.stdout.write(`parseMBox - no colon in line ${i} from ${lines.length}:\n${line}\n`);

            continue;
            //throw new Error(`Failed to parse header line '${line}`);
        }
        const key = line.substr(0, colon);
        let value = replaceAll(line.substr(colon + 2), "\n ", " ");
        value = replaceAll(value, "\n", " ").trim();
        switch (key.toLowerCase()) {
            case "cc": cc = (cc || []).concat(value.split(", ")); break;
            case "date": date = value; break;
            case "fcc": break;
            case "from": from = decode(value.trim()); break;
            case "message-id": messageId = value; break;
            case "subject": subject = value; break;
            case "to": to = value; break;
            default:
                headers.push({ key, value });
        }
    }

    if (!gentle && (!to || !subject || !from)) {
        throw new Error(`Missing To, Subject and/or From header:\n${header}`);
    }

    return {
        body,
        cc,
        date,
        from,
        headers,
        messageId,
        raw: mbox,
        subject,
        to,
    };
}

export function parseMBoxMessageIDAndReferences(parsed: IParsedMBox): { messageID: string; references: string[] } {
    const references: string[] = [];
    const seen: Set<string> = new Set<string>();
    /*
     * This regular expression parses whitespace-separated lists of the form
     * <MESSAGE-ID> [(COMMENT ["QUOTED"])], i.e. lists of message IDs that are
     * enclosed in pointy brackets, possibly followed by a comment that is
     * enclosed in parentheses which possibly contains one quoted string.
     *
     * This is in no way a complete parser for RFC2822 (which is not possible
     * using regular expressions due to its recursive nature) but seems to be
     * good enough for the Git mailing list.
     */
    const msgIdRegex =
        /^\s*<([^>]+)>(\s*|,)(\([^")]*("[^"]*")?\)\s*|\([^)]*\)$)?(<.*)?$/;
    for (const header of parsed.headers ?? []) {
        if (header.key === "In-Reply-To" || header.key === "References") {
            let value: string = header.value;
            while (value) {
                const match: any = value.match(msgIdRegex);
                if (!match) {
                    if (value !== undefined && !value.match(/^\s*$/)) {
                        throw new Error(`Error parsing Message-ID '${value}'`);
                    }
                    break;
                }
                if (!seen.has(match[1])) {
                    references.push(match[1]);
                    seen.add(match[1]);
                }
                value = match[5];
            }
        }
    }
    if (!parsed.messageId) {
        throw new Error(`No Message-ID found in ${parsed.raw}`);
    }
    const messageID = parsed.messageId.match(/^<(.*)>$/);
    if (!messageID) {
        throw new Error(`Unexpected Message-ID format: ${parsed.messageId}`);
    }
    return { messageID: messageID[1], references };
}

export async function sendMail(mail: IParsedMBox,
    smtpOptions: ISMTPOptions):
    Promise<string> {
    const transportOpts: SMTPTransport.Options = {
        auth: {
            pass: smtpOptions.smtpPass,
            user: smtpOptions.smtpUser,
        },
        host: smtpOptions.smtpHost,
        secure: true,
    };

    if (smtpOptions.smtpOpts) {
        // Add quoting for JSON.parse
        const smtpOpts = smtpOptions.smtpOpts
            .replace(/([ {])([a-zA-Z0-9.]+?) *?:/g, "$1\"$2\":");
        Object.assign(transportOpts, JSON.parse(smtpOpts));
    }

    await new Promise(res => setTimeout(res, 5000)); // Sleep for 5 seconds

    return new Promise<string>((resolve, reject) => {
        const transporter = createTransport(transportOpts);

        const rawWithHeader = addHeader(
            mail.raw,
            "X-Original-From",
            mail.from ?? ""
        );

        // setup email data with unicode symbols
        const mailOptions: SendMailOptions = {
            envelope: {
                cc: mail.cc ? mail.cc.join(", ") : undefined,
                from: mail.from,
                to: mail.to,
            },
            raw: rawWithHeader
        };

        transporter.sendMail(mailOptions, (error, info: { messageId: string })
            : void => {
            if (error) {
                reject(error);
            } else {
                resolve(info.messageId);
            }
        });
    });
}

function addHeader(raw: string, name: string, value: string): string {
    // Detect which newline style the source uses
    const CRLF = /\r\n/.test(raw) ? "\r\n" : "\n";
    const headerLine = `${name}: ${value}`;

    // Split into individual lines *without* discarding line–breaks
    const lines = raw.split(/\r?\n/);

    // Locate the canonical “From:” header 
    let insertPos = -1;

    for (let i = 0; i < lines.length; i++) {
        if (/^From:/i.test(lines[i])) {
            // Skip any folded continuation lines (start with SP / HT)
            insertPos = i + 1;
            while (insertPos < lines.length && /^[ \t]/.test(lines[insertPos])) {
                insertPos++;
            }
            break;
        }
        // Stop searching once we reach the blank line after headers
        if (lines[i] === "") break;
    }

    // Determine a safe insertion point ---
    if (insertPos === -1) {
        // No From: header found – insert just before the header/body separator
        insertPos = lines.findIndex(l => l === "");
        if (insertPos === -1) {
            // Message is malformed (no blank line) – append one
            lines.push("");
            insertPos = lines.length - 1;
        }
    }

    // Insert (or replace if it already exists) 
    // Remove any existing occurrences of the header we’re about to add
    for (let i = lines.length - 1; i >= 0; i--) {
        if (new RegExp(`^${name}:`, "i").test(lines[i])) lines.splice(i, 1);
    }
    lines.splice(insertPos, 0, headerLine);

    return lines.join(CRLF);
}
