import assert from 'node:assert/strict';
import { test } from 'node:test';
import { familyLayers, prepareStreetLayers, createStreetLayerPicker } from '../frontend/js/street-inputs.js';
import { streetCategory } from '../frontend/js/street-data.js';

const layer = (id, kind='copa_individual', analysisId='job') => ({id,analysisId,modelVersion:2,name:id,
  points:[{feature:{id,properties:{copa_id:id,tipo:kind},geometry:{coordinates:[-50.44,-21.21]}}}]});

test('somente camadas da mesma análise; IDs repetidos geram um marcador', () => {
  const individual=layer('i'), group=layer('g','grupo_de_copas'), other=layer('x','copa_individual','outro');
  assert.equal(familyLayers(individual,[individual,group,other]).length,2);
  const copy={...individual,id:'copia'};
  const prepared=prepareStreetLayers(individual,[individual,group,copy]);
  assert.equal(prepared.camadas.length,3);assert.equal(prepared.points.length,2);
  assert.throws(()=>prepareStreetLayers(individual,[other]),/mesma execução/);
  const changed=structuredClone(group);changed.points[0].feature.id='outro';
  assert.throws(()=>prepareStreetLayers(individual,[changed]),/vínculo/);
  assert.throws(()=>prepareStreetLayers(individual,[]),/ao menos/);
});

test('picker inicia com indivíduos e grupos e preserva escolhas quando chegam outras camadas', t => {
  const previous=globalThis.document;t.after(()=>{globalThis.document=previous;});
  const element=()=>({children:[],append(...items){this.children.push(...items);},replaceChildren(){this.children=[];}});
  const nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  globalThis.document={getElementById:el,createElement:element};
  const individual=layer('i'),group=layer('g','grupo_de_copas'),pending=layer('p','complemento_pendente');
  const all=[individual];const picker=createStreetLayerPicker(()=>individual,()=>all,()=>{});
  picker.refresh();assert.deepEqual(picker.selection().map(l=>l.id),['i']);
  all.push(group,pending);picker.refresh();assert.deepEqual(picker.selection().map(l=>l.id),['i','g']);
  const input=el('street-layer-options').children[1].children[0];input.checked=false;input.onchange();
  picker.refresh();assert.deepEqual(picker.selection().map(l=>l.id),['i']);
  picker.refresh(true);assert.ok(el('street-layer-options').children.every(label=>label.children[0].disabled));
});

test('pendentes não tornam o trecho com pontos-base; cobertura não altera essa legenda', () => {
  assert.equal(streetCategory({properties:{pontos_proximos:3,pontos_base_proximos:0,cobertura_copas_base_percentual:50}}),'no-points');
});
