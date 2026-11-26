import { readSite } from '@/lib/read-site';
import { SuggestionForm } from '@/components/SuggestionForm';

export default async function Suggestions(){
  const {formularios:f}=await readSite();
  return <section className="section pageTop"><div className="container"><div className="pageHeading"><h1>{f.suggestionTitle}</h1><p>{f.suggestionIntro}</p></div><SuggestionForm/></div></section>;
}
