/*
 * testcases/test_memory.c
 * Memory-intensive test case.
 */
#include <stdio.h>
#include <stdlib.h>

void array_copy_ptr(int *src, int *dest, int size) {
    int *p_src = src;
    int *p_dest = dest;
    for (int i = 0; i < size; i++) {
        *p_dest = *p_src;
        p_src++;
        p_dest++;
    }
}

int main() {
    int size = 1000;
    int *a = (int*)malloc(size * sizeof(int));
    int *b = (int*)malloc(size * sizeof(int));
    if (!a || !b) return 1;

    for (int i = 0; i < size; i++) {
        a[i] = i * 2;
    }

    array_copy_ptr(a, b, size);

    printf("Copied index 500: %d\n", b[500]);
    free(a);
    free(b);
    return 0;
}
