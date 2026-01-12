def sieve_of_eratosthenes(limit):
    if limit < 2:
        return []
    sieve = [True] * (limit + 1)
    sieve[0] = sieve[1] = False
    for i in range(2, int(limit ** 0.5) + 1):
        if sieve[i]:
            sieve[i*i : limit+1 : i] = [False] * len(sieve[i*i : limit+1 : i])
    return [i for i, is_prime in enumerate(sieve) if is_prime]

primes = sieve_of_eratosthenes(1000)
print(f"1000以内的素数共有 {len(primes)} 个：")
print(primes)