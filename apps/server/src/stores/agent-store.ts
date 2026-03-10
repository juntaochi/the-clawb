import type { AgentRecord } from "@the-clawb/shared";

export interface AgentStore {
  findByName(name: string): AgentRecord | undefined;
  findByApiKeyHash(hash: string): AgentRecord | undefined;
  create(agent: AgentRecord): void;
}

export class InMemoryAgentStore implements AgentStore {
  private agents = new Map<string, AgentRecord>();

  findByName(name: string): AgentRecord | undefined {
    for (const a of this.agents.values()) {
      if (a.name === name) return a;
    }
    return undefined;
  }

  findByApiKeyHash(hash: string): AgentRecord | undefined {
    return this.agents.get(hash);
  }

  create(agent: AgentRecord): void {
    this.agents.set(agent.apiKeyHash, agent);
  }
}
