import {useRecommendations} from './RecommendationContext.tsx';
import {distanceKm,validCoordinates,type LocatedItem} from '../../../../../packages/domain/src/ranking.ts';
export function LocationControls(){const {enabled,location,status,enable,disable}=useRecommendations();return <section className="location-controls" aria-label="Afstand gebruiken"><label className="distance-toggle"><input type="checkbox" checked={enabled} onChange={e=>e.target.checked?enable():disable()}/><span>Afstand laten meetellen</span></label>
 <p>Geef toestemming voor je locatie om kunst in de buurt hoger te zetten. Je kunt afstand altijd uitschakelen; dan tellen smaak en waarderingen.</p>
 {status==='loading'&&<p role="status">Je locatie wordt opgehaald… Je kunt afstand ondertussen weer uitzetten.</p>}
 {status==='ready'&&location&&<><p className="location-status">Je locatie wordt gebruikt voor jouw volgorde.</p><button type="button" onClick={enable}>Locatie vernieuwen</button></>}
 {status==='denied'&&<p role="status">Geen locatietoestemming. Je ziet de volgorde op smaak. Je kunt toestemming aanpassen via de locatie-instellingen van je browser.</p>}
 {status==='timeout'&&<p role="status">Je locatie ophalen duurde te lang. Probeer opnieuw of gebruik alleen je smaak.</p>}
 {status==='unavailable'&&<p role="status">Je locatie is niet beschikbaar. Je kunt gewoon verder op basis van je smaak.</p>}
 <small>Je locatie blijft in deze browsersessie en wordt niet naar onze database gestuurd. Je keuze om afstand wel of niet te gebruiken wordt onthouden.</small></section>;}
export function DistanceLabel({item}:{item:LocatedItem}){const {enabled,location}=useRecommendations();if(!enabled||!location)return null;if(!validCoordinates(item))return <p className="distance-label">Afstand onbekend</p>;const distance=distanceKm(location,item);const rounded=distance<1?'< 1':Math.round(distance).toLocaleString('nl-NL');const basis=item.coordinate_precision==='city'?' · schatting op plaatsniveau':item.coordinate_precision==='street'?' · schatting op straatniveau':'';return <p className="distance-label">Ca. {rounded} km hemelsbreed{basis}</p>;}
