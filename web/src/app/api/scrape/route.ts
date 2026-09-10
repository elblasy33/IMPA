import { NextRequest, NextResponse } from "next/server";
import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export const dynamic = "force-dynamic";

interface ScraperState {
  isScraping: boolean;
  activeCategory: string;
  limit: number;
  logs: string[];
  startTime: string | null;
  endTime: string | null;
  exitCode: number | null;
  process: ChildProcess | null;
}

// Global in-memory state for singleton Node server
declare global {
  var __impaScraperState: ScraperState | undefined;
}

if (!global.__impaScraperState) {
  global.__impaScraperState = {
    isScraping: false,
    activeCategory: "",
    limit: 50,
    logs: ["Ready to start scraping ShipServ."],
    startTime: null,
    endTime: null,
    exitCode: null,
    process: null,
  };
}

const state = global.__impaScraperState;

function addLog(message: string) {
  const time = new Date().toLocaleTimeString();
  const line = `[${time}] ${message.trim()}`;
  state.logs.push(line);
  if (state.logs.length > 200) {
    state.logs.shift();
  }
}

export async function GET() {
  return NextResponse.json({
    isScraping: state.isScraping,
    activeCategory: state.activeCategory,
    limit: state.limit,
    logs: state.logs,
    startTime: state.startTime,
    endTime: state.endTime,
    exitCode: state.exitCode,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const category = String(body.category || "23").trim();
    const limit = Math.min(200, Math.max(5, Number(body.limit) || 50));

    if (state.isScraping) {
      return NextResponse.json(
        { error: "A scraping job is already actively running." },
        { status: 409 }
      );
    }

    // Resolve script path statically
    const parentPath = path.join(process.cwd(), "..", "scraper", "main.py");
    const localPath = path.join(process.cwd(), "scraper", "main.py");
    const absPath = "/home/beso/IMPA/scraper/main.py";

    let scriptPath = "";
    if (fs.existsSync(parentPath)) {
      scriptPath = parentPath;
    } else if (fs.existsSync(localPath)) {
      scriptPath = localPath;
    } else if (fs.existsSync(absPath)) {
      scriptPath = absPath;
    }

    if (!scriptPath) {
      return NextResponse.json(
        { error: "Scraper script (main.py) could not be located on server." },
        { status: 500 }
      );
    }

    // Initialize state
    state.isScraping = true;
    state.activeCategory = category;
    state.limit = limit;
    state.startTime = new Date().toISOString();
    state.endTime = null;
    state.exitCode = null;
    state.logs = [];

    addLog(`🚀 Starting live scraping job: Category [${category}] with batch limit ${limit}...`);
    addLog(`🌐 Target: https://impa-catalogue.shipserv.com/`);

    const cwd = path.dirname(scriptPath);
    const pyProcess = spawn(
      "python3",
      [scriptPath, "--shipserv", category, "--limit", String(limit)],
      {
        cwd,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      }
    );

    state.process = pyProcess;

    pyProcess.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      text.split("\n").forEach((line) => {
        if (line.trim()) {
          addLog(line);
        }
      });
    });

    pyProcess.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      text.split("\n").forEach((line) => {
        if (line.trim()) {
          addLog(`[STDERR] ${line}`);
        }
      });
    });

    pyProcess.on("close", (code) => {
      state.isScraping = false;
      state.exitCode = code;
      state.endTime = new Date().toISOString();
      state.process = null;
      addLog(`🏁 Scraper finished with exit code ${code}.`);
    });

    pyProcess.on("error", (err) => {
      state.isScraping = false;
      state.exitCode = -1;
      state.endTime = new Date().toISOString();
      state.process = null;
      addLog(`❌ Process error: ${err.message}`);
    });

    return NextResponse.json({
      success: true,
      message: `Scraper started for category ${category}`,
      category,
      limit,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  if (state.process && state.isScraping) {
    try {
      state.process.kill("SIGTERM");
      state.isScraping = false;
      state.process = null;
      addLog("⚠️ Scraper job manually cancelled by user.");
      return NextResponse.json({ success: true, message: "Scraper cancelled." });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  return NextResponse.json({ message: "No active scraper was running." });
}
