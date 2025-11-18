#!/bin/bash

echo "🧪 Validando todos os endpoints do sistema..."
echo ""

BASE_URL="http://localhost:10000"
PASSED=0
FAILED=0

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para testar endpoint
test_endpoint() {
    local method=$1
    local path=$2
    local data=$3
    local description=$4
    
    echo -n "Testing $method $path ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$path")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$path" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} ($http_code)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} ($http_code)"
        echo "   Response: $body"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "=== Endpoints Básicos ==="
test_endpoint "GET" "/" "" "Root endpoint"
test_endpoint "GET" "/health" "" "Health check"
echo ""

echo "=== Endpoints de API ==="
test_endpoint "GET" "/api/status" "" "Status do sistema"
test_endpoint "GET" "/api/analytics" "" "Analytics"
echo ""

echo "=== Endpoints de Teste ==="
test_endpoint "POST" "/api/test" '{"message": "Hola"}' "Teste simples"
test_endpoint "POST" "/api/test" '{"message": "¿Cuáles son los juegos más populares?"}' "Teste jogos"
test_endpoint "POST" "/api/test" '{"message": "¿Cómo deposito dinero?"}' "Teste depósito"
test_endpoint "POST" "/api/test" '{"message": "Tengo problemas con el juego"}' "Teste ludopatía"
echo ""

echo "=== Resultados ==="
TOTAL=$((PASSED + FAILED))
echo -e "Total: $TOTAL testes"
echo -e "${GREEN}Passaram: $PASSED${NC}"
echo -e "${RED}Falharam: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Todos os testes passaram!${NC}"
    exit 0
else
    echo -e "${RED}❌ Alguns testes falharam${NC}"
    exit 1
fi
