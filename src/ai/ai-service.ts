export interface AIRequest {
  prompt: string;
  contextText?: string;
  imageDataUrl?: string;
  mode?: 'ask' | 'summarize' | 'explain' | 'research' | 'notes' | 'translate';
}

export interface AIProvider {
  name: string;
  generateResponse(request: AIRequest, apiKey?: string): Promise<string>;
}

export class OpenRouterProvider implements AIProvider {
  name = 'OpenRouter';
  async generateResponse(request: AIRequest, apiKey?: string): Promise<string> {
    if (!apiKey) {
      return this.fallbackResponse(request);
    }
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [
            {
              role: 'system',
              content: 'You are Lunar AI, an intelligent browser assistant embedded in Lunar Browser. Provide helpful, concise, and clear answers.',
            },
            {
              role: 'user',
              content: `${request.prompt}\n\nContext:\n${request.contextText || 'No context provided.'}`,
            },
          ],
        }),
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'No response generated.';
    } catch (err: any) {
      return `OpenRouter Error: ${err.message}`;
    }
  }

  private fallbackResponse(request: AIRequest): string {
    if (request.mode === 'summarize') {
      return `[Lunar AI Demo Summary]\n- Content highlights: ${request.contextText?.slice(0, 150) || 'Active page context'}...\n- Key take-aways: High relevance, structured layout, verified privacy rules.\n(Provide an API Key in Settings for live AI completions).`;
    }
    return `Lunar AI (Demo Mode): You asked "${request.prompt}". Configure your API key in Lunar Settings to enable live LLM integration.`;
  }
}

export class GeminiProvider implements AIProvider {
  name = 'Gemini';
  async generateResponse(request: AIRequest, apiKey?: string): Promise<string> {
    if (!apiKey) {
      return `Gemini AI (Demo Mode): Responding to "${request.prompt}". Add your Gemini API Key in Settings to get real-time responses.`;
    }
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${request.prompt}\n\nPage Text:\n${request.contextText || ''}` }] }],
        }),
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
    } catch (err: any) {
      return `Gemini Error: ${err.message}`;
    }
  }
}

export class AIService {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    this.providers.set('openrouter', new OpenRouterProvider());
    this.providers.set('gemini', new GeminiProvider());
  }

  public async ask(providerName: string, request: AIRequest, apiKey?: string): Promise<string> {
    const provider = this.providers.get(providerName) || this.providers.get('openrouter')!;
    return provider.generateResponse(request, apiKey);
  }
}
