import { useEffect, useState } from "react";
import { commonsPhoto, loadPhoto, webPhoto, wikiPhoto } from "../photos";

export default function HeroImage({ destination }) {
  const city = destination.split(",")[0].trim();
  const [img, setImg] = useState(null);

  useEffect(() => {
    let off = false;
    loadPhoto(`hero|${destination}`, async () => (await wikiPhoto(city, 1400)) || (await commonsPhoto(`${city} skyline`, 1400)) || (await webPhoto(`${city} travel`, city)))
      .then((r) => !off && setImg(r));
    return () => { off = true; };
  }, [destination]);

  if (!img) return null;
  return (
    <>
      <div className="hero-img" style={{ backgroundImage: `url(${img.hero || img.src})` }} role="img" aria-label={destination} />
      <a className="hero-credit" href={img.page} target="_blank" rel="noreferrer">Photo: {img.credit}</a>
    </>
  );
}
