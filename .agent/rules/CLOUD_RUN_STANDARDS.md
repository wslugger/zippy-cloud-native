---
trigger: always_on
---

# Cloud Run & Next.js Deployment Standards

## Core Philosophy
We are deploying to a fully managed, stateless containerized environment (Google Cloud Run). Scalability to zero and rapid cold starts are critical for our performance metrics.

## Architectural Rules
* **Strict Statelessness:** All Next.js API routes MUST be completely stateless. Do not rely on local memory, file system state, or server-side sessions. Use JWTs for authentication and externalize all application state to the database.
* **Cold-Start Optimization:** Avoid heavy, synchronous imports at the top level of your files. Use dynamic imports where applicable to keep the initial Node execution context as light as possible.
* **Container Dependency Parity:** If you add a Node module that relies on native bindings or requires specific OS-level packages (e.g., sharp, bcrypt), you MUST immediately update the `Dockerfile` to include the required Alpine Linux packages.