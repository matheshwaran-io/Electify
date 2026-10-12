import type { SubjectContent } from "@/lib/subjects/content-schema";

/**
 * Cloud Computing: illustrative subject profile.
 *
 * NOT an official SRM syllabus. Everything below is editorial guidance written
 * for students choosing electives, marked PROPOSED/UNVERIFIED so the UI says so.
 * Official facts (course code, credits, seats, basket) come from the elective
 * offering in each registration event, never from this file.
 *
 * To replace with faculty-approved content: edit this file (or upsert via
 * upsertSubjectProfile), set each section's provenance to OFFICIAL with its
 * source and verifiedAt date, then re-run `npm run db:seed:subjects`.
 */

const EDITORIAL = { status: "PROPOSED", source: "Electify editorial draft" } as const;

export const cloudComputingProfile: {
  slug: string;
  title: string;
  courseCode: string | null;
  aliases: string[];
  summary: string;
  content: SubjectContent;
} = {
  slug: "cloud-computing",
  title: "Cloud Computing",
  courseCode: null, // no verified university code; offerings show their own code
  aliases: ["Cloud Computing", "Introduction to Cloud Computing", "Cloud Computing Fundamentals"],
  summary:
    "How applications run on shared, on-demand infrastructure: service models, virtualisation, storage, security and the trade-offs of running software in the cloud.",
  content: {
    tags: ["Virtualisation", "IaaS / PaaS / SaaS", "Storage", "Security", "DevOps", "Cost"],
    overview: {
      provenance: EDITORIAL,
      paragraphs: [
        "Cloud computing is the delivery of computing resources, such as servers, storage, databases and networking, as on-demand services that you pay for as you use them, instead of buying and running your own hardware.",
        "The subject looks at how that works underneath (virtualisation and shared infrastructure), the different ways it is offered (service and deployment models), and what changes when you build and run software on it: reliability, security, monitoring and cost.",
        "It sits close to everyday software development. Most modern web and mobile backends, data pipelines and AI workloads run on cloud platforms, so the ideas carry over directly to building and operating real systems.",
      ],
      learnPoints: [
        "How cloud service and deployment models differ and when each fits",
        "How virtualisation and containers share physical machines safely",
        "How to choose storage and database options for an application",
        "How availability, security and cost shape a cloud design",
      ],
    },
    syllabus: {
      provenance: { status: "UNVERIFIED", source: "Example topic outline for illustration" },
      note: "Example topics only. The faculty-approved syllabus for your programme takes precedence and may differ in units, order and depth.",
      units: [
        {
          title: "Cloud computing fundamentals and architecture",
          topics: ["Essential characteristics of cloud computing", "Shared responsibility", "Regions, zones and data centres", "Elasticity and scalability"],
        },
        {
          title: "Service and deployment models",
          topics: ["IaaS, PaaS and SaaS", "Public, private, hybrid and community clouds", "Choosing a model for a workload"],
        },
        {
          title: "Virtualisation and infrastructure",
          topics: ["Hypervisors and virtual machines", "Containers and orchestration basics", "Virtual networking"],
        },
        {
          title: "Cloud storage and databases",
          topics: ["Object, block and file storage", "Managed relational and NoSQL databases", "Backup and replication"],
        },
        {
          title: "Security, availability and reliability",
          topics: ["Identity and access management", "Encryption in transit and at rest", "Fault tolerance and disaster recovery"],
        },
        {
          title: "Deployment, monitoring and cost management",
          topics: ["Deploying an application", "Logs, metrics and alerts", "Pricing models and cost control"],
        },
      ],
    },
    outcomes: {
      provenance: EDITORIAL,
      items: [
        "Explain cloud service and deployment models and the trade-offs between them",
        "Compare infrastructure options such as virtual machines, containers and managed services",
        "Deploy a basic application to a cloud platform",
        "Apply foundational security principles such as least-privilege access and encryption",
        "Reason about resource usage and its effect on cost",
      ],
    },
    prerequisites: {
      // No `official` block: the university has not provided prerequisites, and the UI says so.
      recommended: ["Comfort with at least one programming language", "Basic operating systems concepts", "Basic computer networking"],
      helpfulSkills: ["Using a command line", "Version control with Git", "Some exposure to databases or SQL"],
    },
    difficulty: {
      level: "MODERATE",
      provenance: { status: "UNVERIFIED", source: "Indicative estimate by Electify" },
      challenges: [
        "Many new terms and services to keep straight early on",
        "Networking and security concepts can be abstract until you deploy something",
      ],
    },
    careers: {
      provenance: { status: "PROPOSED", source: "General career guidance, not a placement or salary claim" },
      roles: [
        { title: "Cloud Engineer", summary: "Designs and builds infrastructure on cloud platforms.", skills: ["Cloud services", "Networking", "Infrastructure as code"] },
        { title: "DevOps / Platform Engineer", summary: "Builds the tooling and pipelines teams use to ship and run software.", skills: ["CI/CD", "Containers", "Automation"] },
        { title: "Backend / Cloud Application Developer", summary: "Builds application services that run on managed cloud components.", skills: ["APIs", "Managed databases", "Serverless"] },
        { title: "Cloud Operations Engineer", summary: "Keeps cloud systems healthy, secure and within budget.", skills: ["Monitoring", "Incident response", "Cost management"] },
        { title: "Site Reliability Engineering pathway", summary: "Applies software engineering to reliability and scale.", skills: ["Observability", "Reliability targets", "Automation"] },
      ],
    },
    resources: [
      {
        title: "The NIST Definition of Cloud Computing (SP 800-145)",
        url: "https://www.nist.gov/publications/nist-definition-cloud-computing",
        provider: "NIST",
        description: "The standard short definition of cloud computing, its essential characteristics, service models and deployment models.",
        kind: "standard",
        relevance: "Fundamentals; service and deployment models",
      },
      {
        title: "Azure Fundamentals: Describe cloud concepts",
        url: "https://learn.microsoft.com/en-us/training/paths/microsoft-azure-fundamentals-describe-cloud-concepts/",
        provider: "Microsoft Learn",
        description: "Free self-paced modules on cloud concepts, benefits and service types.",
        kind: "course",
        relevance: "Fundamentals; service models",
      },
      {
        title: "AWS Skill Builder",
        url: "https://skillbuilder.aws/",
        provider: "Amazon Web Services",
        description: "AWS's training platform, including free cloud practitioner learning paths.",
        kind: "course",
        relevance: "Infrastructure, storage and security in practice",
      },
      {
        title: "Google Cloud training",
        url: "https://cloud.google.com/learn/training",
        provider: "Google Cloud",
        description: "Google Cloud's learning paths and hands-on labs for cloud fundamentals and beyond.",
        kind: "course",
        relevance: "Deployment, data and operations",
      },
    ],
    examples: [
      { title: "Deploy a web application", description: "Run a small website on a managed platform and scale it up during a traffic spike." },
      { title: "Store and serve files", description: "Keep images or documents in object storage and serve them securely to users." },
      { title: "Use a managed database", description: "Let the provider handle backups and patching while your app reads and writes data." },
      { title: "Monitor performance", description: "Watch response times and errors on a dashboard and get alerted when something breaks." },
    ],
  },
};
