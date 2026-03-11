"use client";
import { useCallback } from "react";
import {
  Panel,
  Group,
  Separator,
} from "react-resizable-panels";
import { HydraCanvas } from "./hydra-canvas";
import { StrudelPlayer } from "./strudel-player";
import { StrudelScope } from "./strudel-scope";
import { CodePanel } from "./code-panel";
import { ChatPanel } from "./chat-panel";
import { StatusBar } from "./status-bar";
import { useClubSocket } from "../hooks/use-club-socket";
import { useStrudelAudioBridge } from "../hooks/use-strudel-audio-bridge";

export function Dashboard() {
  const {
    djCode,
    vjCode,
    djAgent,
    vjAgent,
    audienceCount,
    chatMessages,
    sendChat,
  } = useClubSocket();

  const { activate, analyserNode } = useStrudelAudioBridge();

  const handleStrudelReady = useCallback(() => {
    activate();
  }, [activate]);

  return (
    <div className="flex flex-col h-screen bg-black">
      <Group orientation="horizontal" className="flex-1">
        {/* Left: DJ code (big screen) + scope */}
        <Panel defaultSize={65} minSize={30}>
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
              <CodePanel code={djCode} label="DJ (Strudel)" />
            </div>
            <StrudelScope
              analyserNode={analyserNode}
              className="h-24 shrink-0"
            />
          </div>
        </Panel>

        <Separator className="w-1 bg-white/10 hover:bg-white/30 transition-colors" />

        {/* Right: VJ visuals + Chat */}
        <Panel defaultSize={35} minSize={20}>
          <Group orientation="vertical">
            <Panel defaultSize={55} minSize={20}>
              <div className="relative h-full overflow-hidden">
                <HydraCanvas code={vjCode} className="absolute inset-0" />
                <CodePanel code={vjCode} label="VJ" overlay />
              </div>
            </Panel>
            <Separator className="h-1 bg-white/10 hover:bg-white/30 transition-colors" />
            <Panel defaultSize={45} minSize={15}>
              <ChatPanel messages={chatMessages} onSend={sendChat} />
            </Panel>
          </Group>
        </Panel>
      </Group>

      <StatusBar
        djAgent={djAgent}
        vjAgent={vjAgent}
        audienceCount={audienceCount}
      />

      {/* Strudel audio engine (invisible, positioned fixed) */}
      <StrudelPlayer code={djCode} onReady={handleStrudelReady} />
    </div>
  );
}
