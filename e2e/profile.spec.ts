import {test,expect} from '@playwright/test';
import {PROFILE_KEY} from '../packages/domain/src/profile.ts';
test('Onboarding bewaart tags, blijft bereikbaar na herstart en profiel blijft bewerkbaar',async({page})=>{
 await page.goto('/kunstkiezer/');await page.getByRole('button',{name:/^Fotografie/}).click();await page.getByRole('button',{name:/^Historische gebouwen/}).click();
 await page.getByRole('button',{name:'Bewaar mijn smaak en ontdek kunst'}).click();await expect(page).toHaveURL(/\/agenda$/);
 await expect(page.getByRole('link',{name:'Mijn kunstkeuze',exact:true})).toBeVisible();
 await page.goto('/kunstkiezer/');await expect(page).toHaveURL(/\/agenda$/);
 await page.getByRole('link',{name:'Mijn kunstkeuze',exact:true}).click();await expect(page).toHaveURL(/\/kunstkeuze$/);await expect(page.getByRole('heading',{name:'Mijn kunstkeuze.'})).toBeVisible();await expect(page.getByRole('button',{name:/Fotografie/})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('link',{name:'Mijn profiel',exact:true}).click();await expect(page.getByRole('heading',{name:'Mijn profiel.'})).toBeVisible();await expect(page.getByRole('button',{name:'Verwijder tag fotografie',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Verwijder tag fotografie',exact:true}).click();await page.getByLabel('Zoek een extra tag').fill('art deco');await page.getByRole('button',{name:'art deco +',exact:true}).click();
 await page.getByRole('button',{name:'Profiel opslaan',exact:true}).click();await expect(page.getByRole('status')).toContainText('Je profiel is opgeslagen');await page.reload();await expect(page.getByRole('button',{name:'Verwijder tag art deco',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Verwijder tag fotografie',exact:true})).toHaveCount(0);
 const tags=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).tags,PROFILE_KEY);expect(tags).toContain('art deco');expect(tags).toContain('historische architectuur');expect(tags).not.toContain('fotografie');
 expect(await page.evaluate(()=>document.body.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
test('Alle vijf categorieën gebruiken dezelfde profielvoorkeuren',async({page})=>{
 await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({version:1,completed:true,tags:['fotografie']})),PROFILE_KEY);
 await page.route('**/kunstkiezer/api/config',r=>r.fulfill({json:{APP_ENV:'production',PUBLIC_SUPABASE_URL:'https://taste-test.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}}));
 await page.route('https://taste-test.supabase.co/**',async route=>{
 const u=new URL(route.request().url());const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,OPTIONS','content-range':'0-1/2'};
 if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
 const category=u.searchParams.get('category')?.replace('eq.','')??'musea';
 const base={category,city:'Utrecht',province:'Utrecht',street_address:'Teststraat',postal_code:'',website_url:'',summary:'Een collectie.',creator:'',year:'',photos:[],sources:[],selection_reason:'Bijzondere collectie.',visit_notes:'',operating_status:'open',publication_status:'published',starts_on:'2026-01-01',ends_on:'2099-01-01'};
 await route.fulfill({headers,json:[{...base,id:'a',name:'A schilderkunst',tags:['schilderkunst']},{...base,id:'z',name:'Z fotografie',tags:['Fotografie']}]});
 });
 for(const c of ['musea','openbare-kunst','beeldenparken','architectuur','evenementen']){
 await page.goto('/kunstkiezer/agenda/'+c);await expect(page.locator('.museum-card h2').first()).toHaveText('Z fotografie');await expect(page.locator('.taste-match').first()).toContainText('fotografie');await expect(page.getByLabel('Afstand laten meetellen',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Volgorde',{exact:true})).toHaveCount(0);await expect(page.locator('.museum-card')).toHaveCount(2);
 }
});
test('Overal voor open rondt onboarding af zonder voorkeuren',async({page})=>{
 await page.goto('/kunstkiezer/');await page.getByRole('button',{name:'Ik sta overal voor open',exact:true}).click();await expect(page).toHaveURL(/\/agenda$/);await page.reload();await expect(page.getByRole('link',{name:'Mijn kunstkeuze',exact:true})).toBeVisible();
});
test('Geblokkeerde browseropslag verbergt onboarding niet ten onrechte',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('Storage blocked');};});
 await page.goto('/kunstkiezer/');await page.getByRole('button',{name:'Ik sta overal voor open',exact:true}).click();await expect(page.getByRole('status')).toContainText('Je browser kon het profiel niet bewaren');await expect(page.getByRole('link',{name:'Mijn kunstkeuze',exact:true})).toBeVisible();
});
