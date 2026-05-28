import { User, Client } from "@/lib/db-types";

// Types for expanded features
export interface Team {
  id: string;
  name: string;
  description: string;
  color: string;
  members: string[]; // user IDs
  createdAt: Date;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  teamId: string;
  type: "public" | "private";
  members: string[]; // user IDs
  createdAt: Date;
}

export interface Message {
  id: string;
  content: string;
  authorId: string;
  channelId: string;
  createdAt: Date;
  attachments?: File[];
}

export interface File {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedAt: Date;
  ticketId?: string;
  channelId?: string;
}

// Mock Teams
export const mockTeams: Team[] = [
  {
    id: "team-sales",
    name: "Sales",
    description: "Sales and business development team",
    color: "#3b82f6",
    members: ["user-1", "user-2"],
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "team-marketing",
    name: "Marketing",
    description: "Marketing and brand management",
    color: "#8b5cf6",
    members: ["user-3", "user-4"],
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "team-development",
    name: "Development",
    description: "Software development and engineering",
    color: "#22c55e",
    members: ["user-5", "user-6", "user-7"],
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "team-business-analysis",
    name: "Business Analysis",
    description: "Requirements gathering and analysis",
    color: "#f59e0b",
    members: ["user-8", "user-9"],
    createdAt: new Date("2024-01-01"),
  },
];

// Mock Channels
export const mockChannels: Channel[] = [
  {
    id: "channel-sales-general",
    name: "general",
    description: "General sales discussions",
    teamId: "team-sales",
    type: "public",
    members: ["user-1", "user-2"],
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "channel-sales-leads",
    name: "leads",
    description: "New leads and opportunities",
    teamId: "team-sales",
    type: "public",
    members: ["user-1", "user-2"],
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "channel-marketing-general",
    name: "general",
    description: "Marketing team discussions",
    teamId: "team-marketing",
    type: "public",
    members: ["user-3", "user-4"],
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "channel-dev-general",
    name: "general",
    description: "Development team chat",
    teamId: "team-development",
    type: "public",
    members: ["user-5", "user-6", "user-7"],
    createdAt: new Date("2024-01-01"),
  },
];

// Mock Messages
export const mockMessages: Message[] = [
  {
    id: "msg-1",
    content:
      "New client lead from TechCorp - they need a full website redesign",
    authorId: "user-1",
    channelId: "channel-sales-leads",
    createdAt: new Date("2024-01-15T10:00:00"),
  },
  {
    id: "msg-2",
    content:
      "Great! I've scheduled a discovery call for tomorrow. @sarah can you prepare the design brief?",
    authorId: "user-2",
    channelId: "channel-sales-leads",
    createdAt: new Date("2024-01-15T10:15:00"),
  },
  {
    id: "msg-3",
    content:
      "On it! I'll have the brief ready by EOD. Should we include the new branding guidelines?",
    authorId: "user-3",
    channelId: "channel-marketing-general",
    createdAt: new Date("2024-01-15T10:30:00"),
  },
  {
    id: "msg-4",
    content:
      "Yes, definitely. The client specifically mentioned wanting to refresh their brand identity.",
    authorId: "user-1",
    channelId: "channel-sales-leads",
    createdAt: new Date("2024-01-15T10:45:00"),
  },
];

// Mock Files
export const mockFiles: File[] = [
  {
    id: "file-1",
    name: "TechCorp_Brand_Guidelines.pdf",
    url: "/files/techcorp-brand.pdf",
    size: 2048576, // 2MB
    type: "application/pdf",
    uploadedBy: "user-3",
    uploadedAt: new Date("2024-01-15T09:00:00"),
    channelId: "channel-marketing-general",
  },
  {
    id: "file-2",
    name: "Homepage_Wireframes.fig",
    url: "/files/homepage-wireframes.fig",
    size: 512000, // 512KB
    type: "application/figma",
    uploadedBy: "user-3",
    uploadedAt: new Date("2024-01-15T11:00:00"),
    ticketId: "ticket-1",
  },
  {
    id: "file-3",
    name: "Project_Requirements.docx",
    url: "/files/project-requirements.docx",
    size: 1024000, // 1MB
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uploadedBy: "user-8",
    uploadedAt: new Date("2024-01-14T14:00:00"),
    channelId: "channel-dev-general",
  },
];

// Mock Users
export const mockUsers: Omit<User, "id" | "createdAt" | "updatedAt">[] = [
  {
    email: "sarah.designer@company.com",
    password: "hashed_password",
    name: "Sarah Chen",
    role: "USER",
    teamId: null,
    githubToken: null,
  },
  {
    email: "mike.developer@company.com",
    password: "hashed_password",
    name: "Mike Rodriguez",
    role: "USER",
    teamId: null,
    githubToken: null,
  },
  {
    email: "alex.project@company.com",
    password: "hashed_password",
    name: "Alex Thompson",
    role: "USER",
    teamId: null,
    githubToken: null,
  },
  {
    email: "jessica.ux@company.com",
    password: "hashed_password",
    name: "Jessica Park",
    role: "USER",
    teamId: null,
    githubToken: null,
  },
  {
    email: "david.frontend@company.com",
    password: "hashed_password",
    name: "David Kim",
    role: "USER",
    teamId: null,
    githubToken: null,
  },
];

// Mock Clients
export const mockClients: Omit<Client, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "TechStart Inc.",
    email: "contact@techstart.com",
    isInvited: true,
  },
  {
    name: "GreenEats Restaurant",
    email: "manager@greeneats.com",
    isInvited: true,
  },
  {
    name: "FitnessFlow App",
    email: "dev@fitnessflow.com",
    isInvited: true,
  },
  {
    name: "EduTech Solutions",
    email: "support@edutech.com",
    isInvited: true,
  },
  {
    name: "Local Brewery Co.",
    email: "orders@localbrewery.com",
    isInvited: true,
  },
  {
    name: "PetCare Services",
    email: "info@petcare.com",
    isInvited: true,
  },
  {
    name: "Artisan Crafts",
    email: "sales@artisancrafts.com",
    isInvited: true,
  },
  {
    name: "Solar Energy Corp",
    email: "projects@solarcorp.com",
    isInvited: true,
  },
];

// Mock Tickets with realistic scenarios
export const mockTickets = [
  // Website Development Projects
  {
    title: "Homepage Redesign - TechStart Inc.",
    status: "IN_PROGRESS",
    description:
      "Complete redesign of the homepage with modern UI/UX principles. Include hero section, features showcase, and contact form.",
    priority: "HIGH",
    estimatedHours: 24,
    tags: ["design", "frontend", "responsive"],
    createdAt: new Date("2024-01-15"),
    assigneeName: "Sarah Chen",
    clientName: "TechStart Inc.",
  },
  {
    title: "E-commerce Integration - GreenEats",
    status: "CLIENT_REVIEW",
    description:
      "Integrate online ordering system with payment gateway and inventory management.",
    priority: "URGENT",
    estimatedHours: 40,
    tags: ["ecommerce", "backend", "payment"],
    createdAt: new Date("2024-01-10"),
    assigneeName: "Mike Rodriguez",
    clientName: "GreenEats Restaurant",
  },
  {
    title: "Mobile App UI/UX - FitnessFlow",
    status: "REVISIONS",
    description:
      "Design mobile app interface for fitness tracking with workout plans and progress charts.",
    priority: "MEDIUM",
    estimatedHours: 32,
    tags: ["mobile", "ui/ux", "fitness"],
    createdAt: new Date("2024-01-08"),
    assigneeName: "Jessica Park",
    clientName: "FitnessFlow App",
  },
  {
    title: "Learning Management System - EduTech",
    status: "BACKLOG",
    description:
      "Build comprehensive LMS with course creation, student progress tracking, and assessment tools.",
    priority: "HIGH",
    estimatedHours: 80,
    tags: ["lms", "education", "backend"],
    createdAt: new Date("2024-01-12"),
    assigneeName: "Alex Thompson",
    clientName: "EduTech Solutions",
  },
  {
    title: "Inventory Management - Local Brewery",
    status: "COMPLETE",
    description:
      "Develop inventory tracking system for brewery operations with real-time stock updates.",
    priority: "MEDIUM",
    estimatedHours: 28,
    tags: ["inventory", "backend", "database"],
    createdAt: new Date("2024-01-05"),
    assigneeName: "David Kim",
    clientName: "Local Brewery Co.",
  },

  // Bug Fixes and Maintenance
  {
    title: "Payment Gateway Error - TechStart",
    status: "IN_PROGRESS",
    description:
      "Critical bug in payment processing causing transaction failures. Immediate fix required.",
    priority: "URGENT",
    estimatedHours: 4,
    tags: ["bug", "payment", "critical"],
    createdAt: new Date("2024-01-20"),
    assigneeName: "Mike Rodriguez",
    clientName: "TechStart Inc.",
  },
  {
    title: "Mobile Responsiveness Issues - GreenEats",
    status: "IN_PROGRESS",
    description:
      "Fix layout issues on mobile devices for menu display and ordering process.",
    priority: "HIGH",
    estimatedHours: 12,
    tags: ["mobile", "responsive", "frontend"],
    createdAt: new Date("2024-01-18"),
    assigneeName: "David Kim",
    clientName: "GreenEats Restaurant",
  },
  {
    title: "Database Performance Optimization - FitnessFlow",
    status: "BACKLOG",
    description:
      "Optimize database queries to improve app performance and reduce loading times.",
    priority: "MEDIUM",
    estimatedHours: 16,
    tags: ["database", "performance", "optimization"],
    createdAt: new Date("2024-01-16"),
    assigneeName: "Alex Thompson",
    clientName: "FitnessFlow App",
  },

  // New Features and Enhancements
  {
    title: "Dark Mode Implementation - EduTech",
    status: "CLIENT_REVIEW",
    description:
      "Add dark mode toggle to the learning platform with theme persistence.",
    priority: "LOW",
    estimatedHours: 8,
    tags: ["frontend", "dark-mode", "ui"],
    createdAt: new Date("2024-01-14"),
    assigneeName: "Jessica Park",
    clientName: "EduTech Solutions",
  },
  {
    title: "Analytics Dashboard - Local Brewery",
    status: "IN_PROGRESS",
    description:
      "Create comprehensive analytics dashboard for sales, inventory, and customer data.",
    priority: "HIGH",
    estimatedHours: 20,
    tags: ["analytics", "dashboard", "data"],
    createdAt: new Date("2024-01-11"),
    assigneeName: "Sarah Chen",
    clientName: "Local Brewery Co.",
  },
  {
    title: "Push Notifications - FitnessFlow",
    status: "BACKLOG",
    description:
      "Implement push notifications for workout reminders and achievement celebrations.",
    priority: "MEDIUM",
    estimatedHours: 14,
    tags: ["mobile", "notifications", "push"],
    createdAt: new Date("2024-01-13"),
    assigneeName: "David Kim",
    clientName: "FitnessFlow App",
  },

  // Content and Marketing
  {
    title: "SEO Optimization - TechStart",
    status: "COMPLETE",
    description:
      "Optimize website for search engines with meta tags, structured data, and performance improvements.",
    priority: "MEDIUM",
    estimatedHours: 10,
    tags: ["seo", "marketing", "optimization"],
    createdAt: new Date("2024-01-07"),
    assigneeName: "Alex Thompson",
    clientName: "TechStart Inc.",
  },
  {
    title: "Blog Content Management - GreenEats",
    status: "IN_PROGRESS",
    description:
      "Create content management system for blog posts with rich text editor and image uploads.",
    priority: "LOW",
    estimatedHours: 18,
    tags: ["cms", "content", "blog"],
    createdAt: new Date("2024-01-09"),
    assigneeName: "Jessica Park",
    clientName: "GreenEats Restaurant",
  },
  {
    title: "Social Media Integration - FitnessFlow",
    status: "REVISIONS",
    description:
      "Add social sharing features and integration with fitness tracking apps.",
    priority: "MEDIUM",
    estimatedHours: 22,
    tags: ["social", "integration", "api"],
    createdAt: new Date("2024-01-06"),
    assigneeName: "Mike Rodriguez",
    clientName: "FitnessFlow App",
  },

  // Security and Compliance
  {
    title: "GDPR Compliance Update - EduTech",
    status: "IN_PROGRESS",
    description:
      "Update privacy policy and implement GDPR compliance features for European users.",
    priority: "URGENT",
    estimatedHours: 12,
    tags: ["security", "gdpr", "compliance"],
    createdAt: new Date("2024-01-19"),
    assigneeName: "Alex Thompson",
    clientName: "EduTech Solutions",
  },
  {
    title: "SSL Certificate Renewal - Local Brewery",
    status: "COMPLETE",
    description:
      "Renew SSL certificates and update security protocols for all domains.",
    priority: "HIGH",
    estimatedHours: 2,
    tags: ["security", "ssl", "maintenance"],
    createdAt: new Date("2024-01-17"),
    assigneeName: "David Kim",
    clientName: "Local Brewery Co.",
  },

  // Additional Projects
  {
    title: "PetCare Booking System - PetCare Services",
    status: "BACKLOG",
    description:
      "Develop online booking system for pet grooming and veterinary appointments.",
    priority: "HIGH",
    estimatedHours: 35,
    tags: ["booking", "pets", "appointments"],
    createdAt: new Date("2024-01-15"),
    assigneeName: "Sarah Chen",
    clientName: "PetCare Services",
  },
  {
    title: "Artisan Crafts E-commerce - Artisan Crafts",
    status: "IN_PROGRESS",
    description:
      "Build custom e-commerce platform for handmade crafts with vendor management.",
    priority: "MEDIUM",
    estimatedHours: 45,
    tags: ["ecommerce", "handmade", "vendors"],
    createdAt: new Date("2024-01-12"),
    assigneeName: "Mike Rodriguez",
    clientName: "Artisan Crafts",
  },
  {
    title: "Solar Energy Monitoring - Solar Energy Corp",
    status: "CLIENT_REVIEW",
    description:
      "Create monitoring dashboard for solar panel performance and energy production.",
    priority: "HIGH",
    estimatedHours: 30,
    tags: ["iot", "energy", "monitoring"],
    createdAt: new Date("2024-01-10"),
    assigneeName: "Jessica Park",
    clientName: "Solar Energy Corp",
  },
  {
    title: "API Documentation Update - TechStart",
    status: "BACKLOG",
    description:
      "Update API documentation with new endpoints and improve developer experience.",
    priority: "LOW",
    estimatedHours: 6,
    tags: ["api", "documentation", "devops"],
    createdAt: new Date("2024-01-14"),
    assigneeName: "Alex Thompson",
    clientName: "TechStart Inc.",
  },
  {
    title: "Customer Support Chat - GreenEats",
    status: "IN_PROGRESS",
    description:
      "Integrate live chat support system for customer service and order inquiries.",
    priority: "MEDIUM",
    estimatedHours: 16,
    tags: ["support", "chat", "customer-service"],
    createdAt: new Date("2024-01-11"),
    assigneeName: "David Kim",
    clientName: "GreenEats Restaurant",
  },
  {
    title: "Workout Video Streaming - FitnessFlow",
    status: "REVISIONS",
    description:
      "Add video streaming capabilities for workout tutorials and live sessions.",
    priority: "HIGH",
    estimatedHours: 25,
    tags: ["video", "streaming", "fitness"],
    createdAt: new Date("2024-01-08"),
    assigneeName: "Sarah Chen",
    clientName: "FitnessFlow App",
  },
  {
    title: "Student Progress Reports - EduTech",
    status: "COMPLETE",
    description:
      "Generate detailed progress reports for students with performance analytics.",
    priority: "MEDIUM",
    estimatedHours: 14,
    tags: ["reports", "analytics", "education"],
    createdAt: new Date("2024-01-06"),
    assigneeName: "Jessica Park",
    clientName: "EduTech Solutions",
  },
  {
    title: "Brewery Tour Booking - Local Brewery",
    status: "BACKLOG",
    description: "Create booking system for brewery tours and tasting events.",
    priority: "LOW",
    estimatedHours: 12,
    tags: ["booking", "tours", "events"],
    createdAt: new Date("2024-01-13"),
    assigneeName: "Mike Rodriguez",
    clientName: "Local Brewery Co.",
  },
];

// Helper function to generate random dates within a range
export function getRandomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

// Helper function to get random assignee
export function getRandomAssignee(): string {
  const assignees = mockUsers.map((user) => user.name);
  return assignees[Math.floor(Math.random() * assignees.length)];
}

// Helper function to get random client
export function getRandomClient(): string {
  const clients = mockClients.map((client) => client.name);
  return clients[Math.floor(Math.random() * clients.length)];
}
