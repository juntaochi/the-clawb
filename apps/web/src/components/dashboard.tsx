"use client";
import { useCallback } from "react";
import { Panel, Group, Separator } from "react-resizable-panels";
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
    <div className="relative h-screen bg-black">
      {/* Hydra visuals — fullscreen background */}
      <HydraCanvas
        code={vjCode}
        className="fixed inset-0 w-screen h-screen z-0"
      />

      {/* UI overlay — text/UI elements have dark backdrop, rest is transparent */}
      <div className="relative z-10 flex flex-col h-full">
        <Group orientation="horizontal" className="flex-1">
          {/* Left: DJ code + scope */}
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

          <Separator className="w-1 bg-transparent hover:bg-white/20 transition-colors" />

          {/* Right: VJ code + Chat */}
          <Panel defaultSize={35} minSize={20}>
            <Group orientation="vertical">
              <Panel defaultSize={55} minSize={20}>
                <CodePanel code={vjCode} label="VJ (Hydra)" />
              </Panel>
              <Separator className="h-1 bg-transparent hover:bg-white/20 transition-colors" />
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
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
          <span className="code-line text-white/30 text-xs font-mono tracking-[0.3em]">The Clawb</span>
        </div>
      </div>

      {/* Strudel audio engine (invisible, positioned fixed) */}
      <StrudelPlayer code={djCode} onReady={handleStrudelReady} />
    </div>
  );
}
