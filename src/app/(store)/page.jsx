import HomePage from "../../screens/HomePage.jsx";
import { DEFAULT_LANG } from "../../constants/lang.js";
import { getHomePageData } from "../../server/services/storefrontPrefetchService.js";

export default async function Page() {
  const initialData = await getHomePageData(DEFAULT_LANG);

  return <HomePage initialData={initialData} initialLang={DEFAULT_LANG} />;
}
