import React, { useState, useEffect } from "react";
import { Download, FileCode, Folder, Copy, Check, Terminal, ExternalLink, ShieldCheck } from "lucide-react";
import { toMathBold } from "../utils/mathBold";

export const CodeExplorer: React.FC = () => {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string>("main.py");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch("/api/bot/files");
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
        if (data.files["main.py"]) {
          setSelectedFile("main.py");
        } else {
          const first = Object.keys(data.files)[0];
          if (first) setSelectedFile(first);
        }
      }
    } catch (e) {
      console.error("Failed to load files:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!files[selectedFile]) return;
    navigator.clipboard.writeText(files[selectedFile]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileList = Object.keys(files).sort();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border-2 border-slate-900 rounded-2xl p-5 shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-black">
              {toMathBold("PRODUCTION READY PYTHON CODEBASE")}
            </span>
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-wide">
            {toMathBold("SOURCE CODE & ZIP DEPLOYMENT")}
          </h2>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">
            Complete Python project files for standalone Telegram bot hosting with Telethon & asyncio event loops.
          </p>
        </div>

        <a
          href="/api/bot/download-zip"
          download="ether_bot_v2.zip"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-lg transition-all shrink-0"
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>{toMathBold("DOWNLOAD ZIP")}</span>
        </a>
      </div>

      {/* Code Browser Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* File List */}
        <div className="md:col-span-4 bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="text-xs font-black text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center justify-between">
            <span>{toMathBold("PROJECT TREE")}</span>
            <span className="text-[11px] text-slate-500 font-mono">{fileList.length} files</span>
          </div>

          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {fileList.map((f) => (
              <button
                key={f}
                onClick={() => setSelectedFile(f)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                  selectedFile === f
                    ? "bg-slate-900 text-amber-300 shadow-sm"
                    : "text-slate-800 hover:bg-slate-100"
                }`}
              >
                <FileCode className={`w-4 h-4 shrink-0 ${selectedFile === f ? "text-amber-400" : "text-slate-500"}`} />
                <span className="truncate font-mono">{f}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Code Content */}
        <div className="md:col-span-8 bg-slate-900 border-2 border-slate-900 rounded-2xl shadow-md overflow-hidden flex flex-col h-[560px]">
          <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
            <span className="font-mono text-amber-400 font-bold">{selectedFile}</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] font-bold"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy Code"}</span>
            </button>
          </div>
          <div className="p-4 flex-1 overflow-auto bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed selection:bg-amber-400 selection:text-black">
            <pre>{files[selectedFile] || "Loading code..."}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
