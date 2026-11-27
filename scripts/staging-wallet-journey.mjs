import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import bs58 from "bs58";
import { randomBytes } from "node:crypto";

export async function checkWalletJourney(page, user, baseUrl) {
  const ref = process.env.STAGING_SUPABASE_PROJECT_REF;
  const url = new URL(readFileSync("supabase/.temp/pooler-url", "utf8").trim());
  if (!baseUrl.includes("-staging.") || url.username !== "postgres." + ref || !url.hostname.endsWith(".pooler.supabase.com")) {
    throw new Error("Wallet fixture requires the linked staging pooler.");
  }
  const mint = bs58.encode(randomBytes(32));
  execFileSync("psql", ["-Xq", "-v", "ON_ERROR_STOP=1", "-v", "owner="+user.uid, "-v", "mint="+mint], {
    env: { ...process.env, PGDATABASE: url.toString(), PGPASSWORD: process.env.STAGING_SUPABASE_DB_PASSWORD },
    input: `begin;
      insert into public.wallet_links(user_id,address,label) values (:'owner',:'mint','Pilot fixture') returning id as link_id \\gset
      insert into public.wallet_events(user_id,wallet_link_id,signature,block_time,mint,direction,sol_change,token_change,raw)
      values (:'owner',:'link_id',repeat('A',88),now()-interval '1 minute',:'mint','buy',-1,100,'{"balanceBefore":0,"balanceAfter":100,"token":{"name":"Pilot fixture","symbol":"PILOT"}}'),
             (:'owner',:'link_id',repeat('B',88),now(),:'mint','sell',1.25,-100,'{"balanceBefore":100,"balanceAfter":0}');
      commit;`,
  });
  await page.locator('[data-tour="nav-wallets"]:visible').click();
  const review = page.getByRole("button", { name: "Review as trade" });
  await review.click();
  await page.getByLabel("Reason for entering").fill("Disposable staging review");
  await page.getByLabel("Setup", {exact:false}).filter({visible:true}).last().fill("Retest");
  const saving = page.waitForRequest(req => req.url().endsWith("/api/wallet-events") && req.method()==="POST");
  await page.getByRole("button",{name:"Save to Trades"}).dblclick();
  const req = await saving;
  await page.getByRole("button",{name:"View saved trade"}).waitFor();
  const secondTab = await page.context().newPage();
  try {
    await secondTab.goto(baseUrl);
    const token = (await req.allHeaders()).authorization.slice(7);
    const results = await Promise.all([page,secondTab].map(tab => tab.evaluate(async ({token,body}) => {
      const response = await fetch("/api/wallet-events",{method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body});
      return [response.status,(await response.json()).id];
    },{token, body:req.postData()})));
    assert.equal(results[0][0],200);
    assert.deepEqual(results[0],results[1]);
  } finally { await secondTab.close(); }
  await page.reload();
  await page.locator('[data-tour="nav-wallets"]:visible').click();
  const syncResult = page.waitForResponse(r=>r.url().endsWith("/api/wallet-sync") && r.request().method()==="POST");
  await page.getByRole("button",{name:"Sync wallet",exact:true}).click();
  assert.equal((await syncResult).status(),200);
  await page.locator('[data-tour="nav-journal"]:visible').click();
  await page.getByText("All (1)",{exact:true}).waitFor();
  console.log("PASS saved, concurrently retried across tabs, refreshed, synced and counted exactly one wallet trade.");
}
