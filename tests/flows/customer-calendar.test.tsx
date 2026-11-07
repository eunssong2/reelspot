import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, expect, test, vi } from 'vitest';
import { fixtures } from './setup';
import { router } from './router';
import Calendar from '../../src/app/calendar';
vi.mock('../../src/components/period-picker',()=>({MonthHeader: (props:any)=><month {...props}/>,MonthGrid:(props:any)=><grid {...props}/>}));
let tree:any;
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());vi.useRealTimers();});
test('global calendar paginates memberships, counts same-date schedules and filters without losing their real route',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-06T00:00:00Z'));
 fixtures.api.mockImplementation(async(path:string)=>{
  if(path==='/groups')return {items:[{id:'a',name:'모임 A'}],nextCursor:'next'};
  if(path==='/groups?cursor=next')return {items:[{id:'b',name:'모임 B'}],nextCursor:null};
  const id=path.includes('/groups/a/')?'a':'b';
  return {schedules:[{id:`schedule-${id}`,title:`일정 ${id}`,status:'active',days:[{date:'2026-11-06',dayNo:1,title:null,status:'active',visitCount:0}]}]};
 });
 await act(async()=>{tree=create(<Calendar/>);});
 expect(tree.root.findByType('grid').props.labels['2026-11-06'].text).toBe('2개 일정');
 const chip=tree.root.findAllByType('chip').find((x:any)=>x.props.children==='모임 B');
 await act(async()=>chip.props.onPress());
 expect(tree.root.findByType('grid').props.labels['2026-11-06'].text).toBe('일정 b');
 expect(tree.root.findAllByType('card')).toHaveLength(1);
 await act(async()=>tree.root.findByType('card').props.onPress());
 expect(router.push).toHaveBeenCalledWith({pathname:'/schedule/[id]',params:{id:'schedule-b',date:'2026-11-06'}});
});
