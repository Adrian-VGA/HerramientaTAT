import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCurrentLocation, watchCurrentLocation } from './geolocation'
import { nearestClient } from './clientSelection'
import type { Client } from '../types'
afterEach(()=>vi.unstubAllGlobals())
describe('GPS en movimiento',()=>{
  it('actualiza cercanía y deja de entregar puntos al detenerlo',()=>{
    let success!: PositionCallback
    const clearWatch=vi.fn()
    const watchPosition=vi.fn((callback:PositionCallback)=>{success=callback;return 42})
    vi.stubGlobal('navigator',{geolocation:{watchPosition,clearWatch}})
    const clients:Client[]=[{id:'a',code:'A',name:'A',coordinates:{latitude:0,longitude:0},createdAt:'2026-09-18'},{id:'b',code:'B',name:'B',coordinates:{latitude:0,longitude:1},createdAt:'2026-09-18'}]
    const next=vi.fn()
    const stop=watchCurrentLocation(p=>next(nearestClient(clients,p,true)?.client.id),vi.fn())
    const emit=(longitude:number)=>success({coords:{latitude:0,longitude,accuracy:5},timestamp:1} as GeolocationPosition)
    emit(.01);emit(.99)
    expect(next.mock.calls).toEqual([['a'],['b']])
    stop();emit(.01)
    expect(clearWatch).toHaveBeenCalledWith(42);expect(next).toHaveBeenCalledTimes(2)
  })
  it('informa permiso denegado y admite cancelar el seguimiento',()=>{
    let failure!: PositionErrorCallback
    const clearWatch=vi.fn()
    vi.stubGlobal('navigator',{geolocation:{watchPosition:vi.fn((_success:PositionCallback,error:PositionErrorCallback)=>{failure=error;return 7}),clearWatch}})
    const error=vi.fn();const stop=watchCurrentLocation(vi.fn(),error)
    failure({code:1} as GeolocationPositionError)
    expect(error).toHaveBeenCalledWith('No autorizaste el acceso a la ubicación.');stop();expect(clearWatch).toHaveBeenCalledWith(7)
  })
  it('solicita una lectura nueva para registro y visita, con precisión completa',async()=>{
    const getCurrentPosition=vi.fn((success:PositionCallback)=>success({coords:{latitude:7.893421123,longitude:-72.507821987,accuracy:12.5}} as GeolocationPosition))
    vi.stubGlobal('navigator',{geolocation:{getCurrentPosition}})
    expect(await getCurrentLocation()).toEqual({latitude:7.893421123,longitude:-72.507821987,accuracy:12.5})
    expect(getCurrentPosition.mock.calls[0]).toHaveLength(3)
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function),expect.any(Function),expect.objectContaining({maximumAge:0,enableHighAccuracy:true}))
  })
  it('maneja dispositivos sin GPS',async()=>{
    vi.stubGlobal('navigator',{})
    await expect(getCurrentLocation()).rejects.toThrow('Este navegador')
    const error=vi.fn();watchCurrentLocation(vi.fn(),error)();expect(error).toHaveBeenCalledOnce()
  })
})
