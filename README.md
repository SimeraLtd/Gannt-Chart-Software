# Simera Mission Planner — Azure deployment

A Gantt planner for client missions. Linked tasks move automatically when dates change.
It runs on **Azure Static Web Apps**. People sign in with their Microsoft account, and only the
people you assign in Microsoft Entra ID can get in. The data is kept in an **Azure Storage table**.

```
src/index.html                 the planner page
api/src/functions/planner.js   the API (Azure Functions): GET /api/state, PUT/DELETE /api/{projects|tasks}/{id}
api/src/store.js               reads and writes the storage table
staticwebapp.config.json       sign-in rules: every page and API call needs a signed-in user
dev/mock-server.js             local test server (no Azure needed)
```

## What it costs

| Resource | Plan | Approximate cost |
|---|---|---|
| Static Web App | **Standard** (needed to use your own Entra sign-in) | about US$9 per month |
| Storage account | Standard LRS, Table storage | a few cents per month |

## What you need

- An Azure subscription, and an account that can create resources in it.
- Rights in Microsoft Entra ID to create an app registration (Application Administrator or higher).
- A GitHub account. Azure deploys the site from a GitHub repository each time you push a change.

---

## Step 1: Put the code on GitHub

1. Create a new **private** repository on github.com, for example `simera-planner`.
2. Upload the contents of this folder to it: `src`, `api`, `dev`, `staticwebapp.config.json`, `README.md`, `.gitignore`.
   On the repository page, choose **Add file → Upload files**, or use GitHub Desktop.

## Step 2: Create the storage account

1. In the Azure portal: **Create a resource → Storage account**.
2. Choose a resource group (for example `rg-simera-planner`) and a region near you, for example *UK South* or *West Europe*.
   Set **Redundancy** to *Locally-redundant storage (LRS)*. Keep the other defaults and create it.
3. Open the storage account, then **Security + networking → Access keys**. Copy **Connection string** (key1).

The planner creates its `planner` table the first time it saves something.

## Step 3: Create the Static Web App

1. **Create a resource → Static Web App**.
2. Use the same resource group. Name: `simera-planner`. **Plan type: Standard**.
3. Source: **GitHub**. Sign in, then pick your repository and the `main` branch.
4. Build details: Preset **Custom**.
   - App location: `/src`
   - Api location: `/api`
   - Output location: leave empty
5. Create it. Azure adds a GitHub Actions workflow to your repository and starts the first deployment.
6. Open the Static Web App's **Overview** and note its URL, for example `https://purple-sea-0a1b2c3.azurestaticapps.net`.

## Step 4: Register the app in Microsoft Entra ID (the sign-in)

1. Go to **Microsoft Entra ID → App registrations → New registration**.
   - Name: `Simera Mission Planner`
   - Supported account types: **Accounts in this organizational directory only (single tenant)**.
     Clients you invite as guests (Step 6) still count as "in this directory".
   - Redirect URI: platform **Web**, value `https://<your-site-url>/.auth/login/aad/callback`
2. Click **Register**. On its **Overview**, copy the **Application (client) ID** and the **Directory (tenant) ID**.
3. Go to **Authentication** and tick **ID tokens**, then save.
4. Go to **Certificates & secrets → New client secret**. Choose 24 months, then copy the secret **Value**.
   It is shown only once. Put a reminder in your calendar to renew it before it expires.

## Step 5: Connect the pieces

1. In the Static Web App: **Settings → Environment variables** (called *Configuration* in some views). Add these three:

   | Name | Value |
   |---|---|
   | `AZURE_CLIENT_ID` | the Application (client) ID from Step 4 |
   | `AZURE_CLIENT_SECRET` | the client secret value from Step 4 |
   | `STORAGE_CONNECTION_STRING` | the connection string from Step 2 |

   Click **Apply**.
2. In GitHub, edit `staticwebapp.config.json`. Replace `REPLACE_WITH_TENANT_ID` with your Directory (tenant) ID and commit.
   This starts a new deployment, which takes about 2 minutes.

## Step 6: Choose who can get in

This is what keeps the planner limited to the people you choose.

1. Go to **Microsoft Entra ID → Enterprise applications** and open **Simera Mission Planner**.
2. **Properties → Assignment required? → Yes**, then save.
   From now on, anyone you haven't assigned is turned away at sign-in, even if they work at Simera.
3. **Users and groups → Add user/group**, and pick the people who should have access.
   A group such as "Planner users" is easier to manage than adding people one by one.
4. **For clients or other outside people:** go to **Entra ID → Users → New user → Invite external user** and enter their email.
   Then assign them in step 3. They sign in with their own work or Microsoft account.

To remove someone, take them off the list in step 3. They lose access at their next sign-in.

## Step 7: Check it works

Open the site URL. You should see the Microsoft sign-in, then the planner with your name and **Sign out** at the top.
Create a project and drag a task. Then open the site in a second browser as another assigned person:
within about 8 seconds, they see your change.

---

## Good to know

- **Who can edit:** everyone you assign can view *and* edit every project. View-only roles for clients can be added later.
- **How updates appear:** each open page refreshes about every 8 seconds. If two people edit *the same task* at the same moment,
  the last save wins. Edits to different tasks don't affect each other.
- **Backups:** in the Azure portal, open the storage account, then **Data protection**, and turn on point-in-time restore,
  or export the `planner` table regularly with Azure Storage Explorer.
- **Your own address:** in the Static Web App, open **Custom domains** to use an address like `planner.simera-consulting.com`.
  Add the new address as a second Redirect URI in the app registration as well.
- **Testing without Azure:** with Node.js installed, run `node dev/mock-server.js` and open http://localhost:4280.
  It uses a fake user and keeps data in memory only.
