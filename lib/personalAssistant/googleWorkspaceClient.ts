export interface GoogleWorkspaceConfig {
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface CalendarEventInput {
  title: string;
  startIso: string;
  endIso: string;
  timezone?: string;
  description?: string;
  attendees?: string[];
  location?: string;
  includeMeetLink?: boolean;
}

export interface CalendarEventSummary {
  id: string;
  htmlLink?: string;
  meetingLink?: string;
  title?: string;
  startIso?: string;
  endIso?: string;
}

export interface CalendarListInput {
  timeMinIso: string;
  timeMaxIso: string;
  maxResults?: number;
}

export interface CalendarListItem {
  id: string;
  title: string;
  startIso?: string;
  endIso?: string;
  htmlLink?: string;
}

export interface CreateDocumentInput {
  title: string;
  content?: string;
  shareWith?: string[];
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

export interface SendEmailInput {
  to: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  threadId?: string;
  inReplyTo?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
}

interface CalendarInsertResponse {
  id?: string;
  htmlLink?: string;
  hangoutLink?: string;
  summary?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
}

interface CalendarListResponse {
  items?: Array<{
    id?: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    htmlLink?: string;
  }>;
}

interface DocsCreateResponse {
  documentId?: string;
  title?: string;
}

interface DocsGetResponse {
  body?: {
    content?: Array<{
      endIndex?: number;
    }>;
  };
}

interface GmailListResponse {
  messages?: Array<{ id?: string; threadId?: string }>;
}

interface GmailGetResponse {
  id?: string;
  threadId?: string;
  snippet?: string;
  payload?: {
    headers?: Array<{
      name?: string;
      value?: string;
    }>;
  };
}

interface GmailSendResponse {
  id?: string;
  threadId?: string;
}

export class GoogleWorkspaceClient {
  private accessToken?: string;
  private readonly refreshToken?: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;

  constructor(config: GoogleWorkspaceConfig) {
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  hasAuth(): boolean {
    return Boolean(this.accessToken || (this.refreshToken && this.clientId && this.clientSecret));
  }

  async createCalendarEvent(input: CalendarEventInput): Promise<CalendarEventSummary> {
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("sendUpdates", "all");

    const body: Record<string, unknown> = {
      summary: input.title,
      description: input.description,
      location: input.location,
      start: {
        dateTime: input.startIso,
        timeZone: input.timezone || "UTC",
      },
      end: {
        dateTime: input.endIso,
        timeZone: input.timezone || "UTC",
      },
      attendees: (input.attendees || []).map((email) => ({ email })),
    };

    if (input.includeMeetLink) {
      url.searchParams.set("conferenceDataVersion", "1");
      body.conferenceData = {
        createRequest: {
          requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    const created = await this.requestJson<CalendarInsertResponse>(url.toString(), {
      method: "POST",
      body,
    });

    return {
      id: created.id || "",
      htmlLink: created.htmlLink,
      meetingLink: created.hangoutLink,
      title: created.summary,
      startIso: created.start?.dateTime,
      endIso: created.end?.dateTime,
    };
  }

  async listCalendarEvents(input: CalendarListInput): Promise<CalendarListItem[]> {
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", input.timeMinIso);
    url.searchParams.set("timeMax", input.timeMaxIso);
    url.searchParams.set("maxResults", String(input.maxResults || 20));

    const res = await this.requestJson<CalendarListResponse>(url.toString(), {
      method: "GET",
    });

    return (res.items || [])
      .filter((item): item is NonNullable<CalendarListResponse["items"]>[number] & { id: string } =>
        Boolean(item.id)
      )
      .map((item) => ({
        id: item.id,
        title: item.summary || "Untitled event",
        startIso: item.start?.dateTime || item.start?.date,
        endIso: item.end?.dateTime || item.end?.date,
        htmlLink: item.htmlLink,
      }));
  }

  async createDocument(input: CreateDocumentInput): Promise<{ documentId: string; url: string }> {
    const created = await this.requestJson<DocsCreateResponse>(
      "https://docs.googleapis.com/v1/documents",
      {
        method: "POST",
        body: {
          title: input.title,
        },
      }
    );

    const documentId = created.documentId || "";

    if (!documentId) {
      throw new Error("Google Docs did not return a documentId.");
    }

    if (input.content?.trim()) {
      await this.batchUpdateDocument(documentId, [
        {
          insertText: {
            location: { index: 1 },
            text: input.content,
          },
        },
      ]);
    }

    for (const email of input.shareWith || []) {
      await this.shareDocument(documentId, email);
    }

    return {
      documentId,
      url: `https://docs.google.com/document/d/${documentId}/edit`,
    };
  }

  async appendDocumentText(documentId: string, text: string): Promise<void> {
    const doc = await this.requestJson<DocsGetResponse>(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
      { method: "GET" }
    );

    const content = doc.body?.content || [];
    const last = content[content.length - 1];
    const insertIndex = Math.max(1, (last?.endIndex || 2) - 1);

    await this.batchUpdateDocument(documentId, [
      {
        insertText: {
          location: { index: insertIndex },
          text,
        },
      },
    ]);
  }

  async replaceDocumentText(documentId: string, text: string): Promise<void> {
    const doc = await this.requestJson<DocsGetResponse>(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
      { method: "GET" }
    );

    const content = doc.body?.content || [];
    const last = content[content.length - 1];
    const endIndex = Math.max(2, (last?.endIndex || 2) - 1);

    await this.batchUpdateDocument(documentId, [
      {
        deleteContentRange: {
          range: {
            startIndex: 1,
            endIndex,
          },
        },
      },
      {
        insertText: {
          location: { index: 1 },
          text,
        },
      },
    ]);
  }

  async listInbox(query: string, maxResults: number): Promise<GmailMessageSummary[]> {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", String(maxResults));

    const list = await this.requestJson<GmailListResponse>(url.toString(), {
      method: "GET",
    });

    const messages = list.messages || [];

    const fullMessages = await Promise.all(
      messages
        .filter((item): item is { id: string; threadId: string } => Boolean(item.id && item.threadId))
        .map((item) => this.getMessageMetadata(item.id))
    );

    return fullMessages.filter((item): item is GmailMessageSummary => Boolean(item));
  }

  async getMessageMetadata(messageId: string): Promise<GmailMessageSummary | null> {
    const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`);
    url.searchParams.append("format", "metadata");
    url.searchParams.append("metadataHeaders", "Subject");
    url.searchParams.append("metadataHeaders", "From");
    url.searchParams.append("metadataHeaders", "Date");

    const res = await this.requestJson<GmailGetResponse>(url.toString(), {
      method: "GET",
    });

    if (!res.id || !res.threadId) {
      return null;
    }

    const headers = new Map<string, string>();
    for (const header of res.payload?.headers || []) {
      if (header.name && header.value) {
        headers.set(header.name.toLowerCase(), header.value);
      }
    }

    return {
      id: res.id,
      threadId: res.threadId,
      from: headers.get("from") || "",
      subject: headers.get("subject") || "(No subject)",
      date: headers.get("date") || "",
      snippet: res.snippet || "",
    };
  }

  async sendEmail(input: SendEmailInput): Promise<{ id: string; threadId?: string }> {
    const headers = [
      `To: ${input.to.join(", ")}`,
      input.cc && input.cc.length > 0 ? `Cc: ${input.cc.join(", ")}` : undefined,
      `Subject: ${input.subject}`,
      input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : undefined,
      input.inReplyTo ? `References: ${input.inReplyTo}` : undefined,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      input.bodyText,
    ].filter(Boolean);

    const raw = Buffer.from(headers.join("\r\n"), "utf8").toString("base64url");

    const response = await this.requestJson<GmailSendResponse>(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        body: {
          raw,
          threadId: input.threadId,
        },
      }
    );

    if (!response.id) {
      throw new Error("Gmail send did not return an id.");
    }

    return {
      id: response.id,
      threadId: response.threadId,
    };
  }

  private async shareDocument(documentId: string, email: string): Promise<void> {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(documentId)}/permissions`;

    await this.requestJson<Record<string, unknown>>(url, {
      method: "POST",
      body: {
        role: "writer",
        type: "user",
        emailAddress: email,
      },
    });
  }

  private async batchUpdateDocument(documentId: string, requests: unknown[]): Promise<void> {
    const url = `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`;

    await this.requestJson<Record<string, unknown>>(url, {
      method: "POST",
      body: {
        requests,
      },
    });
  }

  private async requestJson<T>(url: string, init: { method: string; body?: unknown }, retry = true): Promise<T> {
    if (!this.accessToken && !this.refreshToken) {
      throw new Error(
        "Google auth is missing. Set GOOGLE_ACCESS_TOKEN or refresh credentials (GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)."
      );
    }

    if (!this.accessToken && this.refreshToken) {
      await this.refreshAccessToken();
    }

    const response = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    if (response.status === 401 && retry && this.refreshToken) {
      await this.refreshAccessToken();
      return this.requestJson<T>(url, init, false);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google API request failed (${response.status}): ${errorBody}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new Error(
        "Cannot refresh Google token without GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET."
      );
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: "refresh_token",
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google token refresh failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as GoogleTokenResponse;

    if (!data.access_token) {
      throw new Error("Google token refresh did not return an access token.");
    }

    this.accessToken = data.access_token;
  }
}
