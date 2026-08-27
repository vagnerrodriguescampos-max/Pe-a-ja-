#!/usr/bin/env python3
"""Troca o bloco do Painel dentro do index.html pelo conteudo de painel.js.

O painel e escrito num arquivo proprio (da para rodar lint, diff e revisao
nele) e so entao entra no index.html. Trocar o bloco inteiro pelos marcadores,
em vez de aplicar remendos, garante que os dois nunca divirjam em silencio.
"""
import re, sys, pathlib
d = pathlib.Path(__file__).parent
html = (d/'index.html').read_text()
painel = (d/'painel.js').read_text().rstrip('\n')

INI = '/* =========================== PAINEL EXECUTIVO ==========================='
FIM = '\n/* =========================== VARIAÇÃO DE CONTAS'

i = html.index(INI)
j = html.index(FIM, i)
novo = html[:i] + painel + '\n' + html[j:]
(d/'index.html').write_text(novo)
print(f'painel resplicado: {j-i} -> {len(painel)+1} bytes')
