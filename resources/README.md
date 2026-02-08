# Nexus Resources

Este diretório contém os binários, bibliotecas e modelos necessários para o funcionamento do Nexus.

## Estrutura

```
resources/
├── bin/          # Binários executáveis do Whisper
│   └── linux/    # Binários para Linux
├── lib/          # Bibliotecas compartilhadas
│   └── linux/    # Bibliotecas para Linux (.so files)
└── models/       # Modelos do Whisper (.bin files)
```

## Configuração Inicial

### 1. Bibliotecas Necessárias (Linux)

Os binários do Whisper precisam das seguintes bibliotecas:
- `libwhisper.so.1`
- `libggml.so.0`

#### Opção A: Copiar do whisper.cpp compilado

Se você compilou o whisper.cpp manualmente, copie as bibliotecas:

```bash
# Supondo que whisper.cpp está em ~/whisper.cpp
cp ~/whisper.cpp/build/libwhisper.so* resources/lib/linux/
cp ~/whisper.cpp/build/libggml.so* resources/lib/linux/
```

#### Opção B: Instalar no sistema

Alternativamente, você pode instalar o whisper.cpp no sistema:

```bash
# No diretório do whisper.cpp
cd ~/whisper.cpp
mkdir -p build && cd build
cmake ..
make
sudo make install
sudo ldconfig
```

### 2. Modelos do Whisper

Baixe um modelo do Whisper e coloque em `resources/models/`:

```bash
# Modelo tiny (75 MB) - mais rápido, menos preciso
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin -P resources/models/

# Modelo base (142 MB) - balanceado
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin -P resources/models/

# Modelo small (466 MB) - mais preciso
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin -P resources/models/
```

**Recomendado para português:** `ggml-base.bin` ou `ggml-small.bin`

### 3. Verificar Instalação

Teste se o whisper-cli está funcionando:

```bash
# Definir LD_LIBRARY_PATH para usar as libs locais
export LD_LIBRARY_PATH=resources/lib/linux:$LD_LIBRARY_PATH

# Testar o binário
resources/bin/linux/whisper-cli --help
```

## Estrutura Completa Esperada

```
resources/
├── bin/
│   └── linux/
│       ├── whisper-cli          ✓ (já existe)
│       ├── whisper-server       ✓ (já existe)
│       └── ...
├── lib/
│   └── linux/
│       ├── libwhisper.so.1      ⚠️ (precisa ser adicionado)
│       ├── libggml.so.0         ⚠️ (precisa ser adicionado)
│       └── ...
└── models/
    ├── ggml-base.bin            ⚠️ (precisa ser baixado)
    └── ...
```

## Troubleshooting

### Erro: "cannot open shared object file"

Se você receber erros sobre bibliotecas não encontradas:

1. Verifique se as bibliotecas estão em `resources/lib/linux/`:
   ```bash
   ls -la resources/lib/linux/
   ```

2. Verifique as dependências do binário:
   ```bash
   ldd resources/bin/linux/whisper-cli
   ```

3. Certifique-se de que as permissões estão corretas:
   ```bash
   chmod +x resources/bin/linux/whisper-cli
   chmod 644 resources/lib/linux/*.so*
   ```

### Erro: "model not found"

Se o serviço reclamar sobre modelo não encontrado:

1. Baixe um modelo (veja seção 2 acima)
2. Verifique que o arquivo está em `resources/models/`
3. Verifique as permissões do arquivo

## Links Úteis

- [whisper.cpp GitHub](https://github.com/ggerganov/whisper.cpp)
- [Modelos do Whisper](https://huggingface.co/ggerganov/whisper.cpp/tree/main)
- [Documentação do Whisper](https://github.com/openai/whisper)
