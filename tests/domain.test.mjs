import test from 'node:test';
import assert from 'node:assert/strict';
import {baseCandidate,skuCandidates,resolveSku,positiveUnits,validateLocation,packageTotals} from '../src/domain.mjs';
test('Mantener SKU legítimo y retirar solo sufijos finales',()=>{
 assert.equal(baseCandidate('ZXDGTZHGR20-10001V0-S1'),'ZXDGTZHGR20-10001V0');
 assert.equal(baseCandidate('AB.C/V1-s4-v01-v02'),'AB.C/V1');
 assert.equal(baseCandidate('ABC-V01'),'ABC');
 assert.equal(baseCandidate('ABC-S1-OTHER'),'ABC-S1-OTHER');
 assert.deepEqual(skuCandidates('ZXDGTZHGR20-10001V0-S1'),['ZXDGTZHGR20-10001V0-S1','ZXDGTZHGR20-10001V0']);
 assert.deepEqual(skuCandidates('ZXDGTZHGR20-10001V0-S1-V01-V02'),['ZXDGTZHGR20-10001V0-S1-V01-V02','ZXDGTZHGR20-10001V0-S1-V01','ZXDGTZHGR20-10001V0-S1','ZXDGTZHGR20-10001V0']);
});
test('Preferir coincidencia exacta a inferencia',()=>{
 assert.equal(resolveSku('ABC-S1',['ABC','ABC-S1']),'ABC-S1');
 assert.equal(resolveSku('ZXDGTZHGR20-10001V0-S1',['ZXDGTZHGR20-10001V0']),'ZXDGTZHGR20-10001V0');
 assert.equal(resolveSku('ABC-S4-V01-V02',['ABC-S4','ABC']),'ABC-S4');
 assert.equal(resolveSku('ABC-V01',['ABC']),'ABC');
 assert.equal(resolveSku('XYZ-S1',['ABC']),null);
});
test('Rechazar cantidades parciales, negativas, vacías y no numéricas',()=>{
 for(const n of ['',0,-1,'1.5','2abc',100001])assert.throws(()=>positiveUnits(n));
 assert.equal(positiveUnits('2'),2);
});
test('Ubicaciones hasta fila 13, R, nivel 7',()=>{
 assert.deepEqual(validateLocation(13,'R',7),{row:13,position:'R',level:7});
 for(const loc of [[14,'A',1],[1,'S',1],[1,'A',8],[0,'A',1]])assert.throws(()=>validateLocation(...loc));
});
test('Conservar paquetes 2 + 1 y sumar tres sin stock',()=>{
 const lines=[{package:'1',sku:'ABC',quantity:2},{package:'2',sku:'ABC',quantity:1}];
 assert.deepEqual(packageTotals(lines),{ABC:3});assert.equal(lines.length,2);
});
