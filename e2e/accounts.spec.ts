import {test,expect,type Page} from '@playwright/test';
const id='00000000-0000-4000-8000-000000000010';
const user={id:'00000000-0000-4000-8000-000000000099',email:'visitor@example.test',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-04T00:00:00Z'};
const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,aud:'authenticated',role:'authenticated',exp:4000000000},'test'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
function server(){
 let profile:{tags:string[];completed:boolean;updated_at:string}|null=null;let visits:Record<string,unknown>[]=[];let version=0;let failSave=false;let resetUrl='';let signupConfirmed=false;let passwordChanges=0;
 const item={id,name:'Kunst om te delen',city:'Utrecht',province:'Utrecht',street_address:'Teststraat',postal_code:'',country:'NL',website_url:'https://example.test',latitude:null,longitude:null,summary:'Fotografie om bij stil te staan.',operating_status:'open',publication_status:'published',is_art_museum:true,photos:[],tags:['fotografie']};
 async function setup(page:Page){
  await page.addInitScript(()=>Object.defineProperty(navigator,'share',{value:undefined,configurable:true}));
  await page.route('**/kunstkiezer/api/config',r=>r.fulfill({json:{APP_ENV:'production',PUBLIC_SUPABASE_URL:'https://accounts-test.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}}));
  await page.route('https://accounts-test.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,PUT,OPTIONS','content-range':'0-0/1'};const reply=(json:unknown,status=200)=>route.fulfill({json,status,headers});
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(path.endsWith('/token'))return reply({access_token:token,refresh_token:'test',expires_in:3600,token_type:'bearer',user});
   if(path.endsWith('/user')){if(req.method()==='PUT')passwordChanges++;return reply(user);}
   if(path.endsWith('/logout'))return reply({});
   if(path.endsWith('/signup')){signupConfirmed=true;return reply({user,session:null});}
   if(path.endsWith('/recover')){resetUrl=url.searchParams.get('redirect_to')??'';return reply({});}
   if(path.endsWith('/kk_is_editor'))return reply(false);
   if(path.endsWith('/kk_ranking_settings'))return reply({distance_weight:70,tag_weight:30,distance_scale_km:30});
   if(path.endsWith('/kk_profiles'))return reply(profile);
   if(path.endsWith('/kk_save_profile')){const b=req.postDataJSON();if(b.expected_updated_at!==(profile?.updated_at??null))return reply({code:'40001'},409);profile={tags:b.new_tags,completed:b.is_completed,updated_at:'version-'+(++version)};return reply(profile);}
   if(path.endsWith('/kk_seen')){if(req.method()==='POST'){if(failSave)return reply({message:'Unavailable'},503);visits=[req.postDataJSON()];return reply(null);}if(req.method()==='DELETE'){visits=[];return reply(null);}return reply(visits);}
   if(path.endsWith('/kk_museums'))return reply(url.searchParams.has('id')?item:[item]);
   return reply([]);
  });
 }
 return {setup,profile:()=>profile,visits:()=>visits,fail:(v:boolean)=>{failSave=v;},remoteEdit:()=>{profile={tags:['design'],completed:true,updated_at:'remote-'+(++version)};},reset:()=>resetUrl,signup:()=>signupConfirmed,changes:()=>passwordChanges};
}
async function login(page:Page){await page.goto('/kunstkiezer/account');await page.getByLabel('E-mail',{exact:true}).fill(user.email);await page.getByLabel('Wachtwoord',{exact:true}).fill('Test-password-123');await page.locator('form').getByRole('button',{name:'Inloggen',exact:true}).click();await expect(page).toHaveURL(/\/kunstkiezer\/(agenda)?$/);await expect(page.getByRole('heading',{level:1})).toContainText(/Mijn kunstkeuze|Ontdek kunst/);}
test('Profiel en sterren synchroniseren tussen twee apparaten; delen opent hetzelfde onderwerp',async({page,browser})=>{
 const mock=server();await mock.setup(page);await login(page);await expect(page.getByRole('link',{name:'Beheer',exact:true})).toHaveCount(0);
 await page.goto('/kunstkiezer/profiel');await page.getByLabel('Zoek een extra tag').fill('fotografie');await page.getByRole('button',{name:'fotografie +',exact:true}).click();await page.getByRole('button',{name:'Profiel opslaan',exact:true}).click();await expect(page.getByText('Je profiel is opgeslagen.',{exact:false})).toBeVisible();expect(mock.profile()?.tags).toEqual(['fotografie']);
 const second=await browser.newContext();try{const other=await second.newPage();await mock.setup(other);await login(other);await other.goto('/kunstkiezer/profiel');await expect(other.getByRole('button',{name:'Verwijder tag fotografie',exact:true})).toBeVisible();
 await page.goto('/kunstkiezer/agenda/musea');await page.getByRole('button',{name:'✓ Ik heb dit gezien',exact:true}).click();await page.getByRole('button',{name:'4 sterren',exact:true}).click();mock.fail(true);await page.getByRole('button',{name:'Bewaar waardering',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('alert')).toContainText('kon niet worden opgeslagen');mock.fail(false);await page.getByRole('button',{name:'Bewaar waardering',exact:true}).click();await expect(page.getByRole('button',{name:'✓ Gezien · 4 ★',exact:true})).toBeVisible();
 await other.goto('/kunstkiezer/geschiedenis');await expect(other.getByRole('link',{name:'Kunst om te delen',exact:true})).toBeVisible();await expect(other.getByRole('button',{name:'✓ Gezien · 4 ★',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Deel Kunst om te delen',exact:true}).click();const shared=await page.getByLabel('Link naar dit onderwerp').inputValue();expect(shared).toContain('/bekijk?categorie=musea&id='+id);await expect(page.getByRole('link',{name:'WhatsApp ↗'})).toHaveAttribute('href',/^https:\/\/wa.me\//);await page.getByRole('button',{name:'Sluiten',exact:true}).click();await other.goto(shared);await expect(other.getByRole('heading',{name:'Kunst om te delen',exact:true})).toBeVisible();
 await other.goto('/kunstkiezer/account');await other.getByRole('button',{name:'Uitloggen op alle apparaten'}).click();await other.goto('/kunstkiezer/geschiedenis');await expect(other.getByText('Kunst om te delen',{exact:true})).toHaveCount(0);
 await page.screenshot({path:`work/accounts-${test.info().project.name}.png`,fullPage:true});
 }finally{await second.close();}
});
test('Online profiel overschrijft geen gelijktijdige wijziging; geen beheer via directe URL',async({page})=>{
 const mock=server();await mock.setup(page);await login(page);await page.goto('/kunstkiezer/profiel');await page.getByLabel('Zoek een extra tag').fill('fotografie');await page.getByRole('button',{name:'fotografie +',exact:true}).click();mock.remoteEdit();await page.getByRole('button',{name:'Profiel opslaan'}).click();await expect(page.getByRole('status')).toContainText('ander apparaat gewijzigd');expect(mock.profile()?.tags).toEqual(['design']);
 await page.goto('/kunstkiezer/beheer/instellingen');await expect(page.getByText('Deze pagina is alleen beschikbaar voor beheerders.')).toBeVisible();await expect(page.getByRole('button',{name:'Nu updaten',exact:true})).toHaveCount(0);
});
test('Registratie vraagt bevestiging en wachtwoordherstel gebruikt het accountadres',async({page})=>{
 const mock=server();await mock.setup(page);await page.goto('/kunstkiezer/account');await page.getByRole('button',{name:'Account maken',exact:true}).click();await page.getByLabel('E-mail',{exact:true}).fill(user.email);await page.getByLabel('Wachtwoord',{exact:true}).fill('New-test-password-123');await page.getByLabel('Herhaal wachtwoord',{exact:true}).fill('New-test-password-123');await page.locator('form').getByRole('button',{name:'Account maken',exact:true}).click();await expect(page.getByRole('status')).toContainText('bevestig je e-mailadres');expect(mock.signup()).toBe(true);
 await page.getByRole('button',{name:'Wachtwoord vergeten',exact:true}).click();await page.getByRole('button',{name:'Resetlink aanvragen',exact:true}).click();await expect(page.getByRole('status')).toContainText('Als dit e-mailadres een account heeft');expect(mock.reset()).toBe('http://127.0.0.1:8790/kunstkiezer/account?reset=1');
 await login(page);await page.goto('/kunstkiezer/account');await page.getByLabel('Huidig wachtwoord',{exact:true}).fill('Test-password-123');await page.getByLabel('Nieuw wachtwoord (minstens 12 tekens)',{exact:true}).fill('New-password-12345');await page.getByLabel('Herhaal nieuw wachtwoord',{exact:true}).fill('New-password-12345');await page.getByRole('button',{name:'Wachtwoord opslaan',exact:true}).click();await expect.poll(mock.changes).toBe(1);
});
test('Herstellink opent nieuw wachtwoord; een losse reset-parameter omzeilt herauthenticatie niet',async({page})=>{
 const mock=server();await mock.setup(page);
 await page.goto('/kunstkiezer/account?reset=1#access_token='+token+'&refresh_token=test&expires_in=3600&token_type=bearer&type=recovery');
 await expect(page.getByRole('heading',{name:'Kies een nieuw wachtwoord',exact:true})).toBeVisible();
 await expect(page.getByLabel('Huidig wachtwoord',{exact:true})).toHaveCount(0);
 await page.reload();await expect(page.getByLabel('Huidig wachtwoord',{exact:true})).toBeVisible();
});

test('Inloggen kiest de startpagina van het online profiel, account blijft bereikbaar',async({page})=>{
 const mock=server();mock.remoteEdit();await mock.setup(page);await login(page);await expect(page).toHaveURL(/\/agenda$/);await page.goto('/kunstkiezer/account');await expect(page.getByText('Ingelogd als')).toBeVisible();
});
