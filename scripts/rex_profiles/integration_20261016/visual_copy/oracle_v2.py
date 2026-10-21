#!/usr/bin/env python3
"""Correct only v1's logical-color -> framebuffer projection; v1 files stay intact.
Uses v1's exact spatial compositor/copy reference; encoded CRAM words are explicit.
No framebuffer/capture input is accepted.
"""
import hashlib,json,runpy,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
BASE=ROOT/'data/rex_profiles/integration_20261016/visual-copy'
DATA=ROOT/'data/rex_profiles/integration_20261016/visual-copy-v2'
v1=runpy.run_path(str(HERE/'oracle.py'));convert=runpy.run_path(str(HERE/'color_v2.py'))['convert_cram']
def sha(b): return hashlib.sha256(b).hexdigest()
def main():
    out=Path(sys.argv[1]);out.mkdir(exist_ok=False,parents=True)
    a=json.loads((BASE/'assets.json').read_text());model=json.loads((DATA/'color-model.json').read_text());previous=json.loads((BASE/'oracle.json').read_text())
    labels={}
    def bind(rgb,word):
        key=tuple(rgb)
        if key in labels: assert labels[key]==word,'ambiguous logical color label'
        labels[key]=word
    for i,palette in enumerate(a['palettes']):
        for index,rgb in enumerate(palette):bind(rgb,model['encoded_palettes'][i][index])
    for rgb,index in zip(model['logical_background_labels'],model['background_word_indices']):bind(rgb,model['encoded_palettes'][2][index])
    def project(logical):
        result=bytearray()
        for off in range(0,len(logical),4):
            assert logical[off+3]==255
            result.extend(convert(labels[tuple(logical[off:off+3])])[1])
        return bytes(result)
    ds=[v1['destination'](a,w) for w in (1,2)];logical=[v1['pixels'](a,d) for d in ds];ims=[project(im) for im in logical]
    report={'schema':'rex-visual-oracle/v2','methodology':model['methodology'],'source_sha256':sha(bytes(a['source'])),'v1_manifest_sha256':sha((BASE/'oracle.json').read_bytes()),'color_model_sha256':sha((DATA/'color-model.json').read_bytes()),'comparison':{'rgb_tolerance':0,'alpha_tolerance':0,'dimensions':[320,224]},'files':{},'memory_diff_offsets':previous['memory_diff_offsets'],'pixel_diff_indices':previous['pixel_diff_indices'],'negatives':{}}
    def save(name,b): (out/name).write_bytes(b);report['files'][name]=sha(b)
    for w,d,im,old in zip((1,2),ds,ims,logical):
        scope=v1['scope'](a,d)
        assert sha(scope)==previous['files'][f'width{w}.scope.bin']
        assert sha(old)==previous['files'][f'width{w}.rgba']
        for name,b in [(f'width{w}.scope.bin',scope),(f'width{w}.rgba',im),(f'width{w}.png',v1['png'](im))]:save(name,b)
    observed_set=[i//4 for i in range(0,len(ims[0]),4) if ims[0][i:i+4]!=ims[1][i:i+4]]
    assert observed_set==previous['pixel_diff_indices'] and len(observed_set)==3309
    assert len(previous['memory_diff_offsets'])==162
    transpose=bytes(ds[0][(i%7)*16+i//7] for i in range(112))+bytes(16)
    reverse=b''.join(ds[0][r*16:(r+1)*16] for r in range(6,-1,-1))+bytes(16)
    wrong_pixel=bytearray(ims[0]);wrong_pixel[0]=1
    wrong_channel=bytearray(ims[0]);colored=next(i for i in range(0,len(ims[0]),4) if ims[0][i:i+3]==bytes([239,0,0]));wrong_channel[colored:colored+3]=bytes([0,239,0])
    candidates={'other_width':ims[1],'wrong_stride':project(v1['pixels'](a,v1['destination'](a,1,8))),'transpose':project(v1['pixels'](a,transpose)),'reverse_rows':project(v1['pixels'](a,reverse)),'palette_swap':project(v1['pixels'](a,ds[0],True)),'lost_transparency':project(v1['pixels'](a,ds[0],False,True)),'mutated_pixel_one_level':wrong_pixel,'old_v1_conversion':logical[0],'wrong_channel':wrong_channel}
    report['negatives']={name:b!=ims[0] for name,b in candidates.items()}
    bad=bytearray(v1['scope'](a,ds[0]));bad[0]^=1
    report['negatives']['guard_mutation']=bad!=v1['scope'](a,ds[0]);report['negatives']['other_width_buffer']=v1['scope'](a,ds[0])!=v1['scope'](a,ds[1])
    assert all(report['negatives'].values())
    save('color-model.json',(DATA/'color-model.json').read_bytes());save('literal-vectors.json',(DATA/'literal-vectors.json').read_bytes())
    (out/'oracle.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'memory_changed':162,'pixels_changed':len(observed_set),'negatives':len(report['negatives']),'files':report['files']}))
if __name__=='__main__':main()
