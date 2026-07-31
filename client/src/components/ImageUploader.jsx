import {useEffect,useRef,useState} from 'react';
import {Camera,Images,ImagePlus,RotateCcw,RotateCw,ScanLine,Scissors,X} from 'lucide-react';
import {BrowserMultiFormatReader} from '@zxing/browser';
import CropModal from './CropModal.jsx';

export default function ImageUploader({tools,onCode,preferredAction,onActionHandled}){
  const camera=useRef(),gallery=useRef(),video=useRef();
  const controlsRef=useRef(null);
  const [scanner,setScanner]=useState(false);
  const [cropIndex,setCropIndex]=useState(null);
  const [error,setError]=useState('');

  async function add(files){
    try{await tools.add(files);setError('')}catch(e){setError(e.message)}
  }

  async function scan(){
    setScanner(true);
    setTimeout(async()=>{
      try{
        const reader=new BrowserMultiFormatReader();
        controlsRef.current=await reader.decodeFromVideoDevice(undefined,video.current,r=>{
          if(r){onCode(r.getText());controlsRef.current?.stop();setScanner(false)}
        });
      }catch{
        setError('Kamera konnte nicht geöffnet werden.');
        setScanner(false);
      }
    },80);
  }

  useEffect(()=>()=>controlsRef.current?.stop(),[]);

  useEffect(()=>{
    if(!preferredAction) return;
    if(preferredAction==='camera') camera.current?.click();
    else if(preferredAction==='gallery') gallery.current?.click();
    else if(preferredAction==='scanner') scan();
    onActionHandled?.();
  },[preferredAction]);

  return <>
    <div className="capture-grid">
      <button type="button" onClick={()=>camera.current.click()}><Camera/><b>Foto aufnehmen</b><span>Kamera öffnen</span></button>
      <button type="button" onClick={()=>gallery.current.click()}><Images/><b>Aus Galerie hochladen</b><span>Bilder auswählen</span></button>
      <button type="button" onClick={scan}><ScanLine/><b>QR / Barcode scannen</b><span>Code übernehmen</span></button>
    </div>

    <input ref={camera} hidden type="file" accept="image/*" capture="environment" onChange={e=>{add(e.target.files);e.target.value=''}}/>
    <input ref={gallery} hidden type="file" multiple accept="image/*" onChange={e=>{add(e.target.files);e.target.value=''}}/>

    {error&&<div className="inline-error">{error}</div>}

    {tools.images.length>0&&<div className="image-panel"><div><strong>{tools.images.length} von 4 Bildern</strong><small>Etikett möglichst groß und gerade zuschneiden.</small></div><div className="previews">{tools.images.map((src,i)=><div className="preview" key={i}><img src={src} alt={`Bild ${i+1}`}/><button className="remove" onClick={()=>tools.remove(i)}><X/></button><div className="editbar"><button title="Links drehen" onClick={()=>tools.rotate(i,-90)}><RotateCcw/></button><button title="Zuschneiden" onClick={()=>setCropIndex(i)}><Scissors/></button><button title="Rechts drehen" onClick={()=>tools.rotate(i,90)}><RotateCw/></button></div></div>)}{tools.images.length<4&&<button className="add-image" onClick={()=>gallery.current.click()}><ImagePlus/><span>Weiteres Bild</span></button>}</div></div>}

    {cropIndex!==null&&<CropModal src={tools.images[cropIndex]} onClose={()=>setCropIndex(null)} onApply={src=>{tools.replace(cropIndex,src);setCropIndex(null)}}/>}

    {scanner&&<div className="scanner"><button onClick={()=>{controlsRef.current?.stop();setScanner(false);}}><X/></button><video ref={video}/><p>Code in den Rahmen halten</p></div>}
  </>;
}
