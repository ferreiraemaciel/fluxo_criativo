#!/usr/bin/env python3
"""
Atualiza media_drive_url na tabela `ads` para todos os cards que têm
arquivo correspondente no Google Drive mas ainda não têm URL cadastrada.
"""

import os, sys, json, urllib.request, urllib.parse
from pathlib import Path

def load_env():
    cur = Path(__file__).resolve().parent
    while cur.parent != cur:
        candidate = cur / ".env"
        if candidate.exists():
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            return
        cur = cur.parent

load_env()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit("Erro: SUPABASE_URL e SUPABASE_SERVICE_KEY precisam estar no .env")

# Mapeamento ADS numero → URL do Drive (arquivo principal de cada card)
DRIVE_URLS = {
    36:  "https://drive.google.com/file/d/1JpjSm1JfUZbD2ILLSEFsiFOjdQ3-Ml1p/view?usp=drivesdk",
    44:  "https://drive.google.com/file/d/1ZViR78RS2tS1s09bomtAVAkAJtg4L0um/view?usp=drivesdk",
    45:  "https://drive.google.com/file/d/1X8xjubANMvYuTHJLvo7a3p90rd0Jvhw0/view?usp=drivesdk",
    46:  "https://drive.google.com/file/d/1fbxqNjNx01IYVPd3ZJR_Oj_5xesO81u5/view?usp=drivesdk",
    47:  "https://drive.google.com/file/d/1OUqYwcP0VEeLvGQ7W5W3ZHoOUUUgoZNt/view?usp=drivesdk",
    48:  "https://drive.google.com/file/d/1DeLkDGRoCKBNkixZO8TFWnlevAqZHgJE/view?usp=drivesdk",
    49:  "https://drive.google.com/file/d/1cGmU82G22tj5M-VHJ0gi0wwx60aqGDvd/view?usp=drivesdk",
    50:  "https://drive.google.com/file/d/1QwVdUQUPg_FRwPi2x06ebAk-9hx4qqPj/view?usp=drivesdk",
    51:  "https://drive.google.com/file/d/16TzGq7003oG2ZJEhGBi8y41fc13Ugkgs/view?usp=drivesdk",
    54:  "https://drive.google.com/file/d/1rqmyeyoOia6PJqf57tag2niyhQvBrUul/view?usp=drivesdk",
    55:  "https://drive.google.com/file/d/1GO2DaQioktUP9jZ5RKhIGFMu-hubzq7c/view?usp=drivesdk",
    56:  "https://drive.google.com/file/d/1yA74wArD3ThlPO7OMix-UVa6XlrNHHfS/view?usp=drivesdk",
    57:  "https://drive.google.com/file/d/1N0qHJmAO6yrr84Jq3z-vFNxD9Seda6J9/view?usp=drivesdk",
    58:  "https://drive.google.com/file/d/17_8z8lLwh48uwEXcYiLwamIS5cZkcEb7/view?usp=drivesdk",
    59:  "https://drive.google.com/file/d/1Tii8i9Tti7qoRCWRxQoopnkq9ByqCf10/view?usp=drivesdk",
    60:  "https://drive.google.com/file/d/1RIRO1HYqUwYzwzZrskBGHpzfSyGwfLyi/view?usp=drivesdk",
    61:  "https://drive.google.com/file/d/1KvhzSCCfYcrjEYxj-MJdnHqkRNdXjiQV/view?usp=drivesdk",
    62:  "https://drive.google.com/file/d/1k7xKSg1vUJiUmKp4RkA6rdymYwFvLYJp/view?usp=drivesdk",
    63:  "https://drive.google.com/file/d/1WTJCI9Ddl6c4E8Wj-VT7fDoGmNKKfSSD/view?usp=drivesdk",
    66:  "https://drive.google.com/file/d/1wggoHlOyuliYTBQg8dPFwU1nofnNuxlF/view?usp=drivesdk",
    67:  "https://drive.google.com/file/d/1CrhJWpq6D9t1YmMQqab7sYWmvfWrTp0L/view?usp=drivesdk",
    68:  "https://drive.google.com/file/d/1OIUREf73zWDUyVssSVJ8-2YTZ7OgCDE1/view?usp=drivesdk",
    69:  "https://drive.google.com/file/d/1Pa4RJSY5WqHHzk2fd0n5LZHVqczNec50/view?usp=drivesdk",
    71:  "https://drive.google.com/file/d/1K9apQbxqsU9PFeJVCzD17t-tGnVnWWbN/view?usp=drivesdk",
    72:  "https://drive.google.com/file/d/1Yzyqru8adwswX8jd_3mi3OoSVwQuQ3MA/view?usp=drivesdk",
    73:  "https://drive.google.com/file/d/1jcksrhefALDYeo4zFNRLWYDT9tOS91Fe/view?usp=drivesdk",
    74:  "https://drive.google.com/file/d/1YBs3oiFwlj9Wll_d__bqrpMe-pzM5Fiu/view?usp=drivesdk",
    75:  "https://drive.google.com/file/d/19TpmR_lAnLvvIHf3OG_RtRJN8YFe5OE8/view?usp=drivesdk",
    76:  "https://drive.google.com/file/d/1VLGF5dEYJ5jcKG59ZspHp50LdIF3aWMW/view?usp=drivesdk",
    77:  "https://drive.google.com/file/d/1Z9tlf1xO8zE2YgSx6LJqDv7ijtY4F1v2/view?usp=drivesdk",
    78:  "https://drive.google.com/file/d/1IT0pCfVAH6DqnxLacXERhD7vQqVhYZgE/view?usp=drivesdk",
    79:  "https://drive.google.com/file/d/12cP55e48GjTHQJajyC02ZzqTklpbEIkY/view?usp=drivesdk",
    80:  "https://drive.google.com/file/d/15293UZz122DUEDhIndtAlR2_3_5RNJLv/view?usp=drivesdk",
    82:  "https://drive.google.com/file/d/1cHbLoqGZ0c1nn2GBRgxb92CJ7kepn8nn/view?usp=drivesdk",
    83:  "https://drive.google.com/file/d/1Y3reRc6Xxvn4ZYMq0hB4f3ksAXEMSn0s/view?usp=drivesdk",
    84:  "https://drive.google.com/file/d/1xvT6SsHnSbBW3eIOubkIMPBI0yhilnO-/view?usp=drivesdk",
    85:  "https://drive.google.com/file/d/1c3Djfk4vC7nbk3DierfQIM13KlyVjE0z/view?usp=drivesdk",
    86:  "https://drive.google.com/file/d/1vvDI697DuVJab4eFuk1WGzuHzCINwpzT/view?usp=drivesdk",
    87:  "https://drive.google.com/file/d/1BbO37KZGrI0AIdiklSf2EOyl69yPlcMk/view?usp=drivesdk",
    88:  "https://drive.google.com/file/d/1VqCLm_4GMyRl4PprAQkdoH0rb2ovFGaj/view?usp=drivesdk",
    89:  "https://drive.google.com/file/d/16EKg_rlvHyDT_PDrExDHkKChdn8OQYLr/view?usp=drivesdk",
    90:  "https://drive.google.com/file/d/1qjAeHQPKMbgnSa7hjpGHVTUO8wf8FK0g/view?usp=drivesdk",
    91:  "https://drive.google.com/file/d/1NOGM7LgQcUw3lS0KUD97JD740qu8NfHZ/view?usp=drivesdk",
    92:  "https://drive.google.com/file/d/1jseMSoqPwBjlKZp1FM4dNlqE4eiGL_3o/view?usp=drivesdk",
    93:  "https://drive.google.com/file/d/184qX6L2GRkoAcXofzDqWgKU90DF8m1n7/view?usp=drivesdk",
    94:  "https://drive.google.com/file/d/1v9qoAXOs1on3DBMi7_ojpsmOUoBz9A0N/view?usp=drivesdk",
    95:  "https://drive.google.com/file/d/1pExxxhdgtG8nCgFJm3lIfsc1TmETtUED/view?usp=drivesdk",
    96:  "https://drive.google.com/file/d/11O0f3NLPBnBOLSrW-Dwdq7o9liWrhluU/view?usp=drivesdk",
    97:  "https://drive.google.com/file/d/1fXWK_lpMNRaEmBfdSeb18Povc3lGBiBJ/view?usp=drivesdk",
    98:  "https://drive.google.com/file/d/1OHhs8UwEk-57DT4mX_dxt-rWa1_JB5Bc/view?usp=drivesdk",
    100: "https://drive.google.com/file/d/1pNntE0r-MahY_HWkpO7g6O5ZIMEYsj-d/view?usp=drivesdk",
    103: "https://drive.google.com/file/d/1ETA_38nmH1UanUqiU3yMBuqZS0QNNutm/view?usp=drivesdk",
    114: "https://drive.google.com/file/d/1RKN9Alr00dTSSzEMkEVblDINDLrsyzmb/view?usp=drivesdk",
    116: "https://drive.google.com/file/d/1zjVYntyoSw_lPULPdjNsH68g2CU67tHC/view?usp=drivesdk",
    117: "https://drive.google.com/file/d/1qAYhSQ5-5xkjRRLDQX6B5DaN4NRQeU4i/view?usp=drivesdk",
    118: "https://drive.google.com/file/d/1mXGbfiIG5EAFwXixxFmkgk5KCVCaBICy/view?usp=drivesdk",
    119: "https://drive.google.com/file/d/1obuFWjlaFAjVMaiK8a7ckNIl2rRQ5HWC/view?usp=drivesdk",
    120: "https://drive.google.com/file/d/1aTO_BIG1Zn3vYy5pl7pWvAq_eiTFvh3G/view?usp=drivesdk",
    121: "https://drive.google.com/file/d/1XPWfwJZh6dFWNeBFm_Fp_NI9AcNX3yak/view?usp=drivesdk",
    122: "https://drive.google.com/file/d/11c_9xI8c67G8sE2Tr-lHawo-c-aI52et/view?usp=drivesdk",
    123: "https://drive.google.com/file/d/1uVpUlDhfzsQvXjhyIfkP4Vd87COmzu3M/view?usp=drivesdk",
    124: "https://drive.google.com/file/d/1Rh6TzgoR7z9h3fp6Q-urSBGLe_e-IAHV/view?usp=drivesdk",
    125: "https://drive.google.com/file/d/1ZogBPKCKaVnD2M04gwCr5t6zZeUB-a4i/view?usp=drivesdk",
    126: "https://drive.google.com/file/d/1QFKmCDuOFwCX2jsBUsmQx7ESoGTdHZ8d/view?usp=drivesdk",
    127: "https://drive.google.com/file/d/18h9Cgx8eBR65vXLWtjbh-5-4ApGDT449/view?usp=drivesdk",
    128: "https://drive.google.com/file/d/10RWS3UJ5dLQTEJDlBlvdO6-vLyoj2cx6/view?usp=drivesdk",
    129: "https://drive.google.com/file/d/1lmBlqsmWNt80tYivNuVfqSfGgoj7fhWC/view?usp=drivesdk",
    130: "https://drive.google.com/file/d/1co-2MnZ_C90mOI66W0fSxd252znmB2wy/view?usp=drivesdk",
    131: "https://drive.google.com/file/d/1BVBfhRwl8aCyRJP8poSdtIvSWpBeKxgM/view?usp=drivesdk",
    132: "https://drive.google.com/file/d/1zDN83_c6Ckqsb0zT-HfHKCkrnHZYeYDK/view?usp=drivesdk",
    133: "https://drive.google.com/file/d/1gLjvM33oGRsA45pDPJSVHxfJsNerSacb/view?usp=drivesdk",
    134: "https://drive.google.com/file/d/1_TggQ0-umim1eZWB2WAJ0-xg3Mg3THLB/view?usp=drivesdk",
    135: "https://drive.google.com/file/d/1O-735iCKZ61O9CG8UEKGrl0caE_L2A9X/view?usp=drivesdk",
    136: "https://drive.google.com/file/d/15gWVl8CGE6Bl10oY20F8uKfmP_tA1Hzw/view?usp=drivesdk",
    137: "https://drive.google.com/file/d/1uHLJ3ZAFw98uki33mGXwVNa0-7mAuyrW/view?usp=drivesdk",
    138: "https://drive.google.com/file/d/1-SYmpBZUtcGilDgr2TtbfTdPbWLU1Q8i/view?usp=drivesdk",
    139: "https://drive.google.com/file/d/1u6ftW0nWWaJYCgCvd_JYJL67fdVSbbZA/view?usp=drivesdk",
    140: "https://drive.google.com/file/d/1dN-fv2-EU8okd2RNBDE1B366F6S9x2Lx/view?usp=drivesdk",
    141: "https://drive.google.com/file/d/1SYdh2JsBqaBdpn5qDoPQRzrPHAnuJtAL/view?usp=drivesdk",
    142: "https://drive.google.com/file/d/1yGsVIYOkWTVV8gaflKnHGtglPOnGVY1W/view?usp=drivesdk",
    143: "https://drive.google.com/file/d/1_68BMu7eqqJukJYkbPOFYnCLp4bPaB6B/view?usp=drivesdk",
    144: "https://drive.google.com/file/d/11doyZn9LNOsVNNIzgA1Ts2Ii5aeiYy-T/view?usp=drivesdk",
    145: "https://drive.google.com/file/d/19N7b662a_t3JTGTIdiv_2MawX7FEQm/view?usp=drivesdk",
    146: "https://drive.google.com/file/d/1673YKZwFnpYITyMejWWsehfuQSNLv8ZV/view?usp=drivesdk",
    147: "https://drive.google.com/file/d/1au2jj8A84ssjSU8j9sGrk6hTLgHh0V7i/view?usp=drivesdk",
    148: "https://drive.google.com/file/d/1F6okhXZfDX241UZ4OY0N5UxB6KZSxo2z/view?usp=drivesdk",
    149: "https://drive.google.com/file/d/1mlQlcxgoNnGuOIOP57MdTdD1GvhSi0E1/view?usp=drivesdk",
    150: "https://drive.google.com/file/d/1tm7FyroF6aP5ouM7jPsclKn3dCloA71-/view?usp=drivesdk",
    151: "https://drive.google.com/file/d/1Va0Rrh3_MA0s_uwhtK_xXIKZjfNh0cPN/view?usp=drivesdk",
    152: "https://drive.google.com/file/d/1Bkf2Xl8XtLaMivp3csLN1OCtS0k9oK0M/view?usp=drivesdk",
    153: "https://drive.google.com/file/d/1PhFPPdB9S2Tf777BX79Oq6TxqsUBAJDl/view?usp=drivesdk",
    154: "https://drive.google.com/file/d/1dGnqKIUHFVUuBommJOVQYy6XB1_Gz6yQ/view?usp=drivesdk",
    155: "https://drive.google.com/file/d/1SSnyNG0CLrs7uK3271wmb0n3ILh3obcX/view?usp=drivesdk",
    156: "https://drive.google.com/file/d/1zjr0mmI0iBHbqxO06fZTsLnNKd9Yz1xb/view?usp=drivesdk",
    157: "https://drive.google.com/file/d/1meCGgf4ut5t5bjkBsnEVeEarHz1G5kIJ/view?usp=drivesdk",
    158: "https://drive.google.com/file/d/1iVSPsjDvD7bgx51s8VVbG8Nn_O3MEMqJ/view?usp=drivesdk",
    159: "https://drive.google.com/file/d/132ZbhKpMqlA0HuRSJyuXRl5obxbYDbC8/view?usp=drivesdk",
    160: "https://drive.google.com/file/d/1jBNlPOH14xueVRqgVKfz-I-sq5fL6g4J/view?usp=drivesdk",
    161: "https://drive.google.com/file/d/1UMpm62ZwCdCdivcU77sEXATfwuCiXQRe/view?usp=drivesdk",
    162: "https://drive.google.com/file/d/1r_bXHqXNTQECXNzmtQFUY1GoBbjRmpSs/view?usp=drivesdk",
    163: "https://drive.google.com/file/d/1A91YoYWeLas6YJKZr-6qL3BBkd0XZ4Qf/view?usp=drivesdk",
    164: "https://drive.google.com/file/d/195Lonq2bAXL8fb5CcKQoNBTN3KSleTJU/view?usp=drivesdk",
    165: "https://drive.google.com/file/d/12yjajOspDDbIcK83GoWvHvKkDd9FQw0y/view?usp=drivesdk",
    166: "https://drive.google.com/file/d/1ozthkv2eiUaTrtxwCpb5CYAk4Rx9hatt/view?usp=drivesdk",
    167: "https://drive.google.com/file/d/1lPiWTmaBWEICdAXS3yUxK5Y4xkNqdCeT/view?usp=drivesdk",
    168: "https://drive.google.com/file/d/1KxLvKbp7mOspauDBvaiZ6ekFZ3iiuPP9/view?usp=drivesdk",
    172: "https://drive.google.com/file/d/1Kq5aBfYnUR0uYSfnbMI2ej9rky1ZnzZB/view?usp=drivesdk",
    173: "https://drive.google.com/file/d/1CQvSNdW5bD_1B6fmodq18p4SGLSfI-W5/view?usp=drivesdk",
    174: "https://drive.google.com/file/d/1osJlomERVxGuFAMo3fmwyMHeK5Z4ZF15/view?usp=drivesdk",
    185: "https://drive.google.com/file/d/18e3mkDWk2yv-WcbqaMbL_JM48Mz9SLLN/view?usp=drivesdk",
    188: "https://drive.google.com/file/d/1-SMNxVB5MeqtkUz7SLd2SmhsG2_TleS0/view?usp=drivesdk",
    193: "https://drive.google.com/file/d/15G3BWTfD6C1VMx8RmDdOoMYgivFZO_dY/view?usp=drivesdk",
    194: "https://drive.google.com/file/d/1xnsauWQdSSXd71qLqZhnIr1TYJjHYdED/view?usp=drivesdk",
    195: "https://drive.google.com/file/d/1OIpLzSinS3h9N0AiTPQMDHru_4gafbrg/view?usp=drivesdk",
    196: "https://drive.google.com/file/d/1rWyxcuRG7fFd8kcZAftx0-yvVkg6q82s/view?usp=drivesdk",
    197: "https://drive.google.com/file/d/1wIl0RK15Vq0yKOKb_6RHZJQU9UzYroU3/view?usp=drivesdk",
    199: "https://drive.google.com/file/d/1peDKoYqtmNUbfT9hiol0VIIQBnXFmzSl/view?usp=drivesdk",
}

HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal",
}

def patch_ad(numero: int, url: str) -> bool:
    endpoint = f"{SUPABASE_URL}/rest/v1/ads?numero=eq.{numero}&media_drive_url=is.null"
    body = json.dumps({"media_drive_url": url}).encode()
    req = urllib.request.Request(endpoint, data=body, method="PATCH", headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as r:
            r.read()
            return True
    except urllib.error.HTTPError as e:
        print(f"  ERRO ADS {numero:03d}: {e.code} {e.read().decode()[:120]}", file=sys.stderr)
        return False

def main():
    ok = 0
    fail = 0
    print(f"Atualizando {len(DRIVE_URLS)} cards com URL do Drive...")
    for numero, url in sorted(DRIVE_URLS.items()):
        if patch_ad(numero, url):
            print(f"  ✓ ADS {numero:03d}")
            ok += 1
        else:
            fail += 1
    print(f"\nConcluído: {ok} atualizados, {fail} erros.")

if __name__ == "__main__":
    main()
