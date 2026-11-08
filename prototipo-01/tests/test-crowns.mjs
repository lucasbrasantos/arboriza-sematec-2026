import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PointLayer, readPoints } from '../frontend/js/points.js';
import { readCrowns, pairCrowns, livingCrowns, createCrownOverlay } from '../frontend/js/crowns.js';

const point = (id, tipo = 'copa_individual') => ({ type:'Feature', id,
  properties:{copa_id:id,tipo}, geometry:{type:'Point',coordinates:[-50.44,-21.21]} });
const crown = (id, tipo = 'copa_individual') => ({ type:'Feature',id,
  properties:{copa_id:id,tipo},geometry:{type:'Polygon',coordinates:[[
    [-50.441,-21.211],[-50.439,-21.211],[-50.439,-21.209],[-50.441,-21.211],
  ]]},
});
const data = features => ({type:'FeatureCollection',features});

test('exclusão e histórico mantêm o par e preservam a geometria original', () => {
  const layer = new PointLayer('v2',[point('a'),point('b','grupo_de_copas')]);
  layer.modelVersion=2;
  layer.crowns=data([crown('a'),crown('b','grupo_de_copas')]);
  const original=JSON.stringify(layer.crowns);
  layer.selected.add(layer.points[0].key);layer.remove();
  assert.deepEqual(livingCrowns(layer).features.map(f=>f.id),['b']);
  assert.equal(layer.history(),true);
  assert.deepEqual(livingCrowns(layer).features.map(f=>f.id),['a','b']);
  assert.equal(layer.history(true),true);
  assert.deepEqual(livingCrowns(layer).features.map(f=>f.id),['b']);
  assert.equal(JSON.stringify(layer.crowns),original);
  // Exportar/reimportar a revisão não ressuscita pares excluídos.
  const exported=JSON.parse(JSON.stringify({...layer.geojson(),arboriza:{copas:livingCrowns(layer)}}));
  const restored=new PointLayer('revisada',readPoints(exported));
  restored.crowns=pairCrowns(exported.arboriza.copas,exported.features);
  assert.deepEqual(livingCrowns(restored).features.map(f=>f.id),['b']);
});

test('v2 bloqueia mover/adicionar, inclusive vazio; manual continua editável', () => {
  const layer=new PointLayer('v2',[point('a')]);layer.modelVersion=2;
  const position=layer.points[0].feature.geometry.coordinates;
  assert.equal(layer.move(new Map([[layer.points[0].key,[-51,-22]]])),false);
  assert.deepEqual(layer.points[0].feature.geometry.coordinates,position);
  assert.equal(layer.add([-51,-22]),false);
  layer.selected.add(layer.points[0].key);layer.remove();
  assert.equal(layer.points.length,0);assert.equal(layer.add([-51,-22]),false);
  const manual=new PointLayer('manual');manual.add([-51,-22]);
  manual.move(new Map([[manual.points[0].key,[-50,-21]]]));
  assert.deepEqual(manual.points[0].feature.geometry.coordinates,[-50,-21]);
});

test('vínculos inválidos são recusados antes de exibir as camadas', () => {
  assert.throws(()=>pairCrowns(data([crown('a')]),[point('b')]),/correspondente/);
  assert.throws(()=>pairCrowns(data([crown('a')]),[point('a'),point('a')]),/duplicados/);
  assert.throws(()=>pairCrowns(data([crown('a')]),[point('a','grupo_de_copas')]),/correspondente/);
  assert.throws(()=>readCrowns(data([crown('a'),crown('a')])),/únicos/);
  const invalid=crown('a');invalid.geometry.coordinates[0][0][0]=Infinity;
  assert.throws(()=>readCrowns(data([invalid])),/válidos/);
});

test('overlay mostra somente pares vivos e destaca a seleção pelo ID', t => {
  const old=globalThis.L;t.after(()=>{globalThis.L=old;});
  const calls={};
  globalThis.L={geoJSON(_,options){
    return { clearLayers(){calls.polygons=[];},addData(collection){
      calls.polygons=collection.features;
      collection.features.forEach(feature=>options.onEachFeature(feature,{
        feature,on(name,fn){calls.click=fn;},setStyle(style){calls.style=style;},
      }));
    },addTo(){calls.visible=true;return this;},remove(){calls.visible=false;return this;}};
  }};
  const map={createPane:()=>({style:{}})};let selected;
  const overlay=createCrownOverlay(map,(id)=>{selected=id;});
  const layer=new PointLayer('v2',[point('a')]);layer.crowns=data([crown('a')]);
  overlay.render(layer,false);assert.equal(calls.visible,false);
  overlay.render(layer,true);assert.equal(calls.visible,true);
  calls.click({originalEvent:{}});assert.equal(selected,'a');
  overlay.select(new Set(['a']));assert.equal(calls.style.color,'#1683e0');
  layer.selected.add(layer.points[0].key);layer.remove();overlay.render(layer,true);
  assert.equal(calls.polygons.length,0);
});
