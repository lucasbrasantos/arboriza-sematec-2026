import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, Database, Pause, Play, RefreshCw } from 'lucide-react'
import { api } from '../../auth/services/api'
import '../styles/urban-base.css'

type Job = { id:string;state:string;step:string;percent?:number;completed?:number;total?:number;eta_seconds?:number|null;elapsed_seconds?:number;summary?:{individuos:number;setores:number} }
type Status = {job:Job|null;published:{id:string;individuos:number;setores:number;published_at:string}|null}
function duration(seconds:number) { const minutes=Math.ceil(seconds/60);return minutes<60?`${minutes} min`:`${Math.floor(minutes/60)} h ${minutes%60} min` }
export default function UrbanBasePanel() {
  const [data,setData]=useState<Status|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [attempt,setAttempt]=useState(0)
  useEffect(()=>{
    const controller=new AbortController();let timer=0
    const poll=async()=>{
      try { const result=await api<Status>('/base-urbana/status',{signal:controller.signal});if(!controller.signal.aborted){setData(result);setError('')} }
      catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Falha ao consultar a base.')}
      if(!controller.signal.aborted)timer=window.setTimeout(()=>void poll(),4000)
    }
    void poll();return ()=>{controller.abort();window.clearTimeout(timer)}
  },[attempt])
  async function act(action:string) {setBusy(true);setError('');try{await api(`/base-urbana/${action}`,{method:'POST'});setAttempt(v=>v+1)}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível concluir a operação.')}finally{setBusy(false)}}
  const job=data?.job
  const running=job?.state==='processando'||job?.state==='iniciando'
  const resumable=job&&['erro','pausada','interrompida'].includes(job.state)
  return <section className="urban-base-panel" aria-labelledby="urban-base-title"><header><Database size={23}/><div><h2 id="urban-base-title">Base urbana permanente</h2><p>Uma análise V2 para os 499 setores. Consultas rápidas, sem reprocessar o mapa.</p></div><Link to="/mapa/comparar">Comparar setores <ArrowUpRight size={17}/></Link></header>
    <div className="urban-base-body"><div className="urban-base-state"><span className={`urban-base-dot ${running?'is-running':''}`}/><strong>{job?.step??'A primeira base está pronta para ser iniciada.'}</strong><span>{data?.published?`Publicada · ${data.published.individuos.toLocaleString('pt-BR')} indivíduos`:'Sem versão publicada'}</span></div>
    {job&&<><progress max={100} value={job.percent??0} aria-label="Progresso da base urbana"/><div className="urban-base-numbers"><span>{Math.floor(job.percent??0)}% · {(job.completed??0).toLocaleString('pt-BR')} / {(job.total??0).toLocaleString('pt-BR')} janelas</span><span>{running?(job.eta_seconds!=null?`Inferência restante: ~${duration(job.eta_seconds)}`:'Estimando etapa atual…'):job.elapsed_seconds?`Tempo de processamento: ${duration(job.elapsed_seconds)}`:''}</span></div></>}
    <div className="urban-base-actions">{running?<button disabled={busy} onClick={()=>void act('pausar')}><Pause size={16}/>Pausar após a janela atual</button>:<>{resumable&&<button disabled={busy} onClick={()=>void act('retomar')}><Play size={16}/>Retomar processamento</button>}<button disabled={busy||!data} onClick={()=>void act('iniciar')}><RefreshCw size={16}/>{job?'Gerar nova versão':'Gerar base urbana V2'}</button></>}{job?.state==='concluida'&&data?.published?.id!==job.id&&<button className="urban-base-publish" disabled={busy} onClick={()=>void act('publicar')}>Publicar base concluída</button>}</div>
    <p className="urban-base-note">O progresso é salvo por janela. A estimativa usa o ritmo observado da inferência; consolidação e exportação vêm depois. A versão publicada permanece disponível durante atualizações.</p>{error&&<p role="alert">{error}</p>}</div></section>
}
