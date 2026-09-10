import { NextRequest, NextResponse } from "next/server";
import { getCampaignStatus, updateCampaignConfig, getCategoryQueue, resetCampaignBudget, resetCampaignAll } from "@/lib/db";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export const dynamic = "force-dynamic";

function getScraperScriptPath(): string {
  const relPath = path.resolve(process.cwd(), "..", "scraper", "campaign_runner.py");
  if (fs.existsSync(relPath)) return relPath;

  const localPath = path.resolve(process.cwd(), "scraper", "campaign_runner.py");
  if (fs.existsSync(localPath)) return localPath;

  return "/home/beso/IMPA/scraper/campaign_runner.py";
}

export async function GET() {
  try {
    const campaign = getCampaignStatus();
    const queue = getCategoryQueue();
    return NextResponse.json({
      campaign,
      queue,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, daily_cap, delay_profile, current_category, limit } = body;

    if (action === "reset_budget") {
      const updated = resetCampaignBudget();
      return NextResponse.json({ success: true, campaign: updated, message: "Daily budget counter reset to 0." });
    }

    if (action === "reset_all") {
      const updated = resetCampaignAll();
      return NextResponse.json({ success: true, campaign: updated, message: "Campaign reset. Starting from Category 11." });
    }

    if (action === "pause") {
      const updated = updateCampaignConfig({ status: "paused" });
      return NextResponse.json({ success: true, campaign: updated });
    }

    if (action === "config") {
      const updated = updateCampaignConfig({
        daily_cap: daily_cap !== undefined ? Number(daily_cap) : undefined,
        delay_profile: delay_profile,
        current_category: current_category,
      });
      return NextResponse.json({ success: true, campaign: updated });
    }

    if (action === "start") {
      const updated = updateCampaignConfig({
        status: "running",
        delay_profile: delay_profile || "stealth",
        daily_cap: daily_cap !== undefined ? Number(daily_cap) : undefined,
        current_category: current_category,
      });

      // Spawn campaign runner in the background
      const scriptPath = getScraperScriptPath();
      const pythonBin = process.env.PYTHON_BIN || "python3";
      const args = ["--run"];
      
      const batchLimit = limit ? Number(limit) : 25;
      args.push(`--limit=${batchLimit}`);
      
      if (delay_profile) {
        args.push(`--profile=${delay_profile}`);
      }
      if (current_category && current_category !== "all") {
        args.push(`--category=${current_category}`);
      }

      try {
        const child = spawn(pythonBin, [scriptPath, ...args], {
          detached: true,
          stdio: "ignore",
          cwd: path.dirname(scriptPath),
        });
        child.unref();
      } catch (err: any) {
        console.error("Failed to spawn scraper process:", err);
      }

      return NextResponse.json({
        success: true,
        message: "Campaign batch started safely in background",
        campaign: updated,
      });
    }

    return NextResponse.json({ error: "Invalid action. Supported: start, pause, config" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
