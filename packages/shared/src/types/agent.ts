export interface AgentRecord {
  id: string;
  name: string;
  apiKeyHash: string;
  createdAt: string;
}

export interface AgentPublic {
  id: string;
  name: string;
  createdAt: string;
}

export interface AgentRegistration {
  apiKey: string;
  agentId: string;
}
