import mongoose from "mongoose";
import { config } from "dotenv";
import { UserModel } from "../models/user.model.js";
import { WorkspaceModel } from "../models/workspace.model.js";
import { CampaignModel } from "../models/campaign.model.js";
import { CampaignMembershipModel } from "../models/campaign-membership.model.js";
import { BriefModel } from "../models/brief.model.js";
import { AssetModel } from "../models/asset.model.js";
import { VersionModel } from "../models/version.model.js";
import { TaskModel } from "../models/task.model.js";
import { ChunkModel } from "../models/chunk.model.js";
import { AuditEventModel } from "../models/audit-event.model.js";
import { hashPassword } from "../services/auth.service.js";
import { ingestBriefDocument } from "../services/rag.service.js";
import { generateAssetEmbedding } from "../services/asset-discovery.service.js";

config();

const dbUrl = process.env.DB_URL;

export async function seedDatabase() {
  console.log("Starting seed script...");
  if (!dbUrl) {
    throw new Error("DB_URL is not defined in environment");
  }

  await mongoose.connect(dbUrl);
  console.log("Connected to MongoDB for seeding.");

  // Clean existing demo data
  const demoEmails = ["producer@demo.com", "editor@demo.com", "reviewer@demo.com"];
  const existingUsers = await UserModel.find({ email: { $in: demoEmails } });
  const userIds = existingUsers.map((u) => u._id);

  await CampaignMembershipModel.deleteMany({ user: { $in: userIds } });
  await WorkspaceModel.deleteMany({ ownerId: { $in: userIds } });
  await CampaignModel.deleteMany({ creator: { $in: userIds } });
  await UserModel.deleteMany({ _id: { $in: userIds } });

  // 1. Create Demo Users
  const passwordHash = await hashPassword("Password123!");

  const producer = await UserModel.create({
    name: "Alex Rivera",
    email: "producer@demo.com",
    password: passwordHash,
    isVerified: true,
    status: "ACTIVE",
  });

  const editor = await UserModel.create({
    name: "Jordan Lee",
    email: "editor@demo.com",
    password: passwordHash,
    isVerified: true,
    status: "ACTIVE",
  });

  const reviewer = await UserModel.create({
    name: "Morgan Vance",
    email: "reviewer@demo.com",
    password: passwordHash,
    isVerified: true,
    status: "ACTIVE",
  });

  console.log("Demo users created.");

  // 2. Create Workspace
  const workspace = await WorkspaceModel.create({
    name: "Apex Media Productions",
    slug: "apex-media-demo",
    ownerId: producer._id,
    description: "Full-service digital video and podcast production agency.",
    members: [
      { user: producer._id, role: "PRODUCER" },
      { user: editor._id, role: "EDITOR" },
      { user: reviewer._id, role: "REVIEWER" },
    ],
  });

  // Calculate this Friday's date
  const now = new Date();
  const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
  const fridayDeadline = new Date(now.getTime() + daysUntilFriday * 24 * 60 * 60 * 1000);
  fridayDeadline.setHours(17, 0, 0, 0);

  // 3. Create Campaign
  const campaign = await CampaignModel.create({
    name: "NovaSound Wireless Earbuds - Spring Launch",
    slug: "novasound-spring-launch",
    clientName: "NovaSound Audio Inc.",
    description: "60-second dedicated sponsor video segment highlighting ANC and battery life.",
    workspace: workspace._id,
    creator: producer._id,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    deliveryDeadline: fridayDeadline,
    status: "IN_REVIEW",
    deliverables: [
      {
        title: "Main 60s Integration Video (16:9)",
        format: "Video (16:9)",
        requirements: "Show product in hand, demonstrate Active Noise Cancellation, clear audio test.",
        sponsorTextRequired: "NovaSound Earbuds feature Active Noise Cancellation with up to 36 hours of battery life. Use code SPRING20 for 20% off.",
        isCompleted: false,
      },
      {
        title: "15s Social Shorts Cutdown (9:16)",
        format: "Video (9:16 Vertical)",
        requirements: "High-energy hook, on-screen text overlay with discount code.",
        sponsorTextRequired: "Use code SPRING20 for 20% off",
        isCompleted: false,
      },
    ],
  });

  // 4. Create Campaign Memberships
  await CampaignMembershipModel.create([
    {
      campaign: campaign._id,
      user: producer._id,
      workspace: workspace._id,
      role: "PRODUCER",
      invitationStatus: "ACCEPTED",
    },
    {
      campaign: campaign._id,
      user: editor._id,
      workspace: workspace._id,
      role: "EDITOR",
      invitationStatus: "ACCEPTED",
      invitedBy: producer._id,
    },
    {
      campaign: campaign._id,
      user: reviewer._id,
      workspace: workspace._id,
      role: "REVIEWER",
      invitationStatus: "ACCEPTED",
      invitedBy: producer._id,
    },
  ]);

  console.log("Campaign and memberships created.");

  // 5. Create Sponsor Brief & Ingest RAG Chunks
  const briefContent = `# NovaSound Spring Campaign Brief & Sponsor Requirements

1. Overview & Objective:
NovaSound Audio Inc. is launching the NovaSound ANC Earbuds this Spring. The goal is to drive awareness and conversions through YouTube video integrations and podcast host-read ads.

2. Mandatory Sponsor Claims & Promo Code:
- Core Claim: NovaSound Earbuds feature Active Noise Cancellation with up to 36 hours of battery life.
- Mandatory Discount Code: Every creator must explicitly state: "Use code SPRING20 for 20% off."
- Call to Action: Direct viewers to the exclusive campaign landing page in the description box.

3. Prohibited Claims & Regulatory Disclaimers:
- Do NOT state that the earbuds are 100% waterproof or suitable for scuba diving (they are IPX4 sweat-resistant only).
- Do NOT make unsubstantiated claims comparing noise cancellation decibels to medical hearing protection.

4. Permitted Channels & Usage Rights:
- Permitted Channels: YouTube, Podcast, and Instagram.
- License Term: Video content may remain posted indefinitely on creator's channel. Paid sponsor cutdowns may be used for 90 days.`;

  const sourceSections = [
    {
      sectionTitle: "Overview & Objectives",
      page: 1,
      content: "NovaSound Audio Inc. is launching the NovaSound ANC Earbuds this Spring. The goal is to drive awareness and conversions through YouTube video integrations and podcast host-read ads.",
    },
    {
      sectionTitle: "Mandatory Sponsor Claims & Promo Code",
      page: 1,
      content: "Core Claim: NovaSound Earbuds feature Active Noise Cancellation with up to 36 hours of battery life. Mandatory Discount Code: Every creator must explicitly state: 'Use code SPRING20 for 20% off.' Call to Action: Direct viewers to the exclusive campaign landing page in the description box.",
    },
    {
      sectionTitle: "Prohibited Claims & Disclaimers",
      page: 2,
      content: "Do NOT state that the earbuds are 100% waterproof or suitable for scuba diving (they are IPX4 sweat-resistant only). Do NOT make unsubstantiated claims comparing noise cancellation decibels to medical hearing protection.",
    },
    {
      sectionTitle: "Permitted Channels & Rights",
      page: 2,
      content: "Permitted Channels: YouTube, Podcast, and Instagram. License Term: Video content may remain posted indefinitely on creator's channel. Paid sponsor cutdowns may be used for 90 days.",
    },
  ];

  const brief = await BriefModel.create({
    campaign: campaign._id,
    workspace: workspace._id,
    title: "NovaSound Spring 2026 Guidelines",
    revisionNumber: 1,
    originalFilename: "NovaSound_Brief_Spring2026.pdf",
    storageKey: "novasound-brief-v1.pdf",
    mimeType: "application/pdf",
    fileSize: 1048576,
    extractedText: briefContent,
    approvedNotes: "Approved by client legal on Oct 1.",
    sourceSections,
    status: "ACTIVE",
    uploadedBy: producer._id,
  });

  campaign.activeBrief = brief._id;
  await campaign.save();

  try {
    await ingestBriefDocument({
      campaignId: campaign._id,
      workspaceId: workspace._id,
      briefId: brief._id,
      revisionNumber: 1,
      extractedText: briefContent,
      sourceSections,
    });
    console.log("Brief ingested and embedded.");
  } catch (ingestErr) {
    console.warn("Brief chunk embedding skipped (Ollama or vector offline):", ingestErr.message);
  }

  // 6. Create Assets (including EXPIRED music license)
  const videoAsset = await AssetModel.create({
    campaign: campaign._id,
    workspace: workspace._id,
    title: "NovaSound Earbuds 4K Product B-Roll",
    originalFilename: "novasound_earbuds_broll_4k.mp4",
    storageKey: "broll-4k.mp4",
    filePath: "./uploads/assets/broll-4k.mp4",
    fileSize: 45000000,
    mimeType: "video/mp4",
    assetType: "VIDEO",
    caption: "Close-up macro pan of the matte black charging case and earbuds glowing indicator.",
    tags: ["b-roll", "close-up", "product", "earbuds", "matte black"],
    usageRights: {
      owner: "NovaSound Audio Inc.",
      licenseStartDate: new Date("2026-01-01"),
      licenseEndDate: new Date("2027-01-01"),
      allowedChannels: ["YouTube", "Podcast", "Instagram"],
      restrictions: "Approved for campaign creators only.",
      isExpired: false,
    },
    approvalStatus: "APPROVED",
    uploadedBy: producer._id,
  });

  // THIS IS THE CRITICAL DEMO ASSET: Music with EXPIRED license!
  const expiredMusicAsset = await AssetModel.create({
    campaign: campaign._id,
    workspace: workspace._id,
    title: "Upbeat Electro Synthwave Intro",
    originalFilename: "synthwave_pulse_intro.mp3",
    storageKey: "synthwave_pulse_intro.mp3",
    filePath: "./uploads/assets/synthwave_pulse_intro.mp3",
    fileSize: 4200000,
    mimeType: "audio/mpeg",
    assetType: "AUDIO",
    caption: "Energetic synth intro track with driving bassline for podcast and video intro.",
    tags: ["music", "intro", "synthwave", "energetic", "soundtrack"],
    usageRights: {
      owner: "SoundGrid Royalty Library",
      licenseStartDate: new Date("2025-03-01"),
      licenseEndDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Expired 30 days ago!
      allowedChannels: ["YouTube"],
      restrictions: "License expired on previous monthly subscription. Commercial use prohibited until renewed.",
      requiredAttribution: "Music by SoundGrid",
      isExpired: true,
    },
    approvalStatus: "APPROVED",
    uploadedBy: editor._id,
  });

  const logoAsset = await AssetModel.create({
    campaign: campaign._id,
    workspace: workspace._id,
    title: "NovaSound Official Vector Logo",
    originalFilename: "novasound_logo_white.png",
    storageKey: "novasound_logo.png",
    filePath: "./uploads/assets/novasound_logo.png",
    fileSize: 180000,
    mimeType: "image/png",
    assetType: "IMAGE",
    caption: "Official vector logo with clear space guidelines.",
    tags: ["logo", "branding", "official", "transparent"],
    usageRights: {
      owner: "NovaSound Audio Inc.",
      licenseStartDate: new Date("2026-01-01"),
      licenseEndDate: new Date("2027-01-01"),
      allowedChannels: ["YouTube", "Podcast", "Instagram", "Social Media"],
      restrictions: "Do not alter logo aspect ratio or colors.",
      isExpired: false,
    },
    approvalStatus: "APPROVED",
    uploadedBy: producer._id,
  });

  try {
    videoAsset.embedding = await generateAssetEmbedding(videoAsset);
    await videoAsset.save();
    expiredMusicAsset.embedding = await generateAssetEmbedding(expiredMusicAsset);
    await expiredMusicAsset.save();
    logoAsset.embedding = await generateAssetEmbedding(logoAsset);
    await logoAsset.save();
  } catch (embErr) {}

  console.log("Assets created (including expired music asset).");

  // 7. Create Submitted Version (v1)
  // CRITICAL DEMONSTRATION ELEMENT: Missing required sponsor promo code "SPRING20" in script!
  const scriptWithoutPromoCode = `[VIDEO INTRO - 0:00 - 0:15]
(Host holds up NovaSound charging case to camera)
"Hey everyone! Welcome back to the channel. Before we dive into today's breakdown, a huge shoutout to our sponsor, NovaSound. 
Their new wireless earbuds feature incredible Active Noise Cancellation and up to 36 hours of battery life on a single charge. 
Whether you're editing audio or commuting on a loud subway, these earbuds block out all distractions."

[SPONSOR OUTRO - 0:45 - 1:00]
"Be sure to check out the link down in the description box to grab your pair today and support the show!"`;

  const version1 = await VersionModel.create({
    campaign: campaign._id,
    workspace: workspace._id,
    versionNumber: 1,
    title: "Rough Cut v1 - Sponsor Segment",
    scriptContent: scriptWithoutPromoCode,
    videoAssetUrl: "https://storage.example.com/novasound/v1_rough_cut.mp4",
    changelog: "First cut submitted for client review. Includes B-Roll and background music.",
    submissionStatus: "SUBMITTED",
    author: editor._id,
    briefRevision: brief._id,
    assetReferences: [videoAsset._id, expiredMusicAsset._id],
    decisions: [],
    submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });

  campaign.activeVersion = version1._id;
  await campaign.save();

  // 8. Create Production Tasks with Schedule Conflict
  const task1 = await TaskModel.create({
    campaign: campaign._id,
    workspace: workspace._id,
    title: "Assemble rough cut and sound design",
    description: "Edit primary dialogue, sync b-roll, and lay background synth music track.",
    assignedTo: editor._id,
    status: "DONE",
    priority: "HIGH",
    dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    createdBy: producer._id,
    completionDetails: {
      completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      completedBy: editor._id,
      notes: "Submitted v1 for client approval.",
    },
  });

  const task2 = await TaskModel.create({
    campaign: campaign._id,
    workspace: workspace._id,
    title: "Brand Reviewer approval sign-off",
    description: "Wait for client reviewer Morgan Vance to review v1 script and sponsor claims.",
    assignedTo: reviewer._id,
    status: "IN_PROGRESS",
    priority: "URGENT",
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    dependencies: [task1._id],
    createdBy: producer._id,
  });

  // Schedule conflict: Due after Friday's delivery deadline!
  const nextMonday = new Date(fridayDeadline.getTime() + 3 * 24 * 60 * 60 * 1000);
  const task3 = await TaskModel.create({
    campaign: campaign._id,
    workspace: workspace._id,
    title: "Final color pass and master encoding",
    description: "Run final 4K HDR mastering and export files for client archive.",
    assignedTo: editor._id,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: nextMonday, // AFTER Friday! Schedule conflict.
    dependencies: [task2._id],
    createdBy: producer._id,
  });

  // 9. Audit Event
  await AuditEventModel.create({
    actor: producer._id,
    action: "CAMPAIGN_SEEDED",
    resourceType: "Campaign",
    resourceId: campaign._id,
    campaign: campaign._id,
    workspace: workspace._id,
    details: {
      campaignName: campaign.name,
      seedScenario: "Project 04 Demonstration Scenario",
    },
    timestamp: new Date(),
  });

  console.log("=================================================");
  console.log("  DEMONSTRATION SEED COMPLETED SUCCESSFULLY!   ");
  console.log("=================================================");
  console.log("Demo Credentials:");
  console.log("  Producer:       producer@demo.com  / Password123!");
  console.log("  Editor:         editor@demo.com    / Password123!");
  console.log("  Brand Reviewer: reviewer@demo.com  / Password123!");
  console.log("Campaign:");
  console.log("  NovaSound Wireless Earbuds - Spring Launch");
  console.log("Demonstration Scenario Artifacts:");
  console.log("  1. Expired Asset: 'Upbeat Electro Synthwave Intro' (license expired)");
  console.log("  2. Missing Requirement: Sponsor text 'Use code SPRING20 for 20% off' omitted from v1 script");
  console.log("  3. Schedule Conflict: Task 3 scheduled after Friday deadline");
  console.log("  4. Submitted Version v1 awaiting Reviewer approval");
  console.log("=================================================");

  await mongoose.disconnect();
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith("seed.js")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
